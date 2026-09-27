#!/usr/bin/env python3
"""Write the customer pack and the sales guide from the local Hive database.

The customer pack is the file you hand over. The sales guide is how you walk
someone through it. Private-key material attackers paste into the shell is
redacted before either PDF is written.
"""

from __future__ import annotations

import argparse
import importlib.util
import re
import sqlite3
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "data" / "db" / "hive.sqlite"
REGULAR = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
BOLD = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
ITALIC = "/usr/share/fonts/truetype/noto/NotoSans-Italic.ttf"
INK = (17, 17, 17)
QUIET = (70, 70, 68)
RULE = (220, 220, 216)
BAND = (244, 244, 241)
PEM_RE = re.compile(r"-----BEGIN [A-Z0-9 ]+-----.*?-----END [A-Z0-9 ]+-----", re.S)


def load_cases():
    spec = importlib.util.spec_from_file_location("hive_cases", ROOT / "backend" / "app" / "cases.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules["hive_cases"] = module
    spec.loader.exec_module(module)
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    rows = con.execute(
        """
        SELECT timestamp, src_ip, src_country, dst_port, protocol, event_type, raw, session_id
        FROM events
        WHERE session_id != ''
        ORDER BY timestamp ASC
        """
    ).fetchall()
    built = module.build_cases([SimpleNamespace(**dict(row)) for row in rows])
    start, end = module.brief_window()
    paragraph = module.overnight_paragraph(built, start, end)
    return built, start, end, paragraph


def redact(text: str, limit: int = 240) -> str:
    cleaned = PEM_RE.sub("[SSH private key redacted]", text or "")
    cleaned = re.sub(r"[A-Za-z0-9+/=]{48,}", "[blob]", cleaned)
    cleaned = " ".join(cleaned.split())
    if len(cleaned) > limit:
        return cleaned[: limit - 1] + "…"
    return cleaned


class Doc(FPDF):
    def __init__(self, footer_label: str):
        super().__init__(format="A4", unit="mm")
        self.footer_label = footer_label
        self.set_auto_page_break(auto=True, margin=18)
        self.add_font("Noto", "", REGULAR)
        self.add_font("Noto", "B", BOLD)
        self.add_font("Noto", "I", ITALIC)
        self.set_margin(16)

    def footer(self):
        self.set_y(-14)
        self.set_draw_color(*RULE)
        self.set_line_width(0.2)
        self.line(16, self.get_y(), 194, self.get_y())
        self.set_y(-12)
        self.set_font("Noto", "", 8)
        self.set_text_color(*QUIET)
        self.cell(120, 6, self.footer_label)
        self.cell(58, 6, str(self.page_no()), align="R")

    def left(self):
        self.set_x(self.l_margin)

    def h1(self, text: str):
        self.left()
        self.set_font("Noto", "B", 18)
        self.set_text_color(*INK)
        self.multi_cell(0, 8, text)
        self.ln(1)

    def h2(self, text: str):
        self.ln(2)
        self.left()
        self.set_font("Noto", "B", 13)
        self.set_text_color(*INK)
        self.multi_cell(0, 7, text)
        self.ln(1)

    def body(self, text: str, size: float = 10.5, style: str = "", color=INK):
        self.left()
        self.set_font("Noto", style, size)
        self.set_text_color(*color)
        self.multi_cell(0, 5.2, text)
        self.ln(1.4)

    def ensure(self, height: float):
        if self.get_y() + height > 275:
            self.add_page()

    def stats(self, items: list[tuple[str, str]]):
        y = self.get_y()
        gap = 3
        width = (178 - gap * (len(items) - 1)) / len(items)
        x = 16
        for value, label in items:
            self.set_fill_color(*BAND)
            self.rect(x, y, width, 18, style="F")
            self.set_xy(x + 3, y + 2)
            self.set_font("Noto", "B", 12)
            self.set_text_color(*INK)
            self.cell(width - 6, 7, value)
            self.set_xy(x + 3, y + 9)
            self.set_font("Noto", "", 8)
            self.set_text_color(*QUIET)
            self.cell(width - 6, 5, label)
            x += width + gap
        self.set_xy(16, y + 22)

    def table(self, headers: list[str], rows: list[list[str]], widths: list[float]):
        self.left()
        self.ensure(16)
        self.set_font("Noto", "B", 8.5)
        self.set_fill_color(*INK)
        self.set_text_color(250, 250, 249)
        for index, header in enumerate(headers):
            self.cell(widths[index], 7, "  " + header, fill=True)
        self.ln(7)
        self.set_font("Noto", "", 8.5)
        for row_index, row in enumerate(rows):
            lines = []
            most = 1
            for index, cell in enumerate(row):
                wrapped = self.multi_cell(widths[index] - 4, 4.4, cell, dry_run=True, output="LINES", align="L")
                lines.append(wrapped)
                most = max(most, len(wrapped))
            row_h = max(7.2, most * 4.4 + 2.4)
            self.ensure(row_h + 2)
            self.set_fill_color(*BAND if row_index % 2 == 0 else (255, 255, 255))
            x0, y0 = self.get_x(), self.get_y()
            self.set_text_color(*INK)
            for index, _wrapped in enumerate(lines):
                self.set_xy(x0 + sum(widths[:index]), y0)
                self.cell(widths[index], row_h, "", fill=True)
                self.set_xy(x0 + sum(widths[:index]) + 2, y0 + 1.4)
                self.multi_cell(widths[index] - 4, 4.4, row[index], align="L")
            self.set_xy(x0, y0 + row_h)
        self.ln(2)


def write_customer_pack(path: Path, built, start, end, paragraph: str) -> None:
    counts = Counter(case.verdict for case in built)
    payloads = [case for case in built if case.verdict == "payload"]
    hands = [case for case in built if case.verdict == "hands"]
    uname_only = sum(1 for case in hands if case.cluster_name == "uname")
    worm = [case for case in payloads if case.cluster_name.startswith("uname ·")]
    pdf = Doc("Hive customer pack  ·  kl-jump-01  ·  26 Sep 2026")
    pdf.add_page()
    pdf.h1("Customer pack")
    pdf.body(
        "This is the file a customer keeps. It covers the decoy jump host kl-jump-01. "
        "Numbers come from sessions stored on this Hive, not from a global threat feed. "
        "Shell text that contained a pasted SSH private key is redacted.",
        color=QUIET,
    )
    pdf.h2("Overnight brief")
    pdf.body(paragraph)
    pdf.body(
        f"Window {start.strftime('%d %b %Y %H:%M')} to {end.strftime('%d %b %Y %H:%M')} Asia/Kuala_Lumpur.",
        size=9,
        style="I",
        color=QUIET,
    )
    pdf.h2("Everything still in retention")
    pdf.stats(
        [
            (str(len(built)), "Sessions"),
            (str(counts["scanner"]), "Scanners"),
            (str(counts["password_guess"]), "Password guesses"),
            (str(counts["payload"]), "Payloads"),
        ]
    )
    pdf.body(
        f"{counts['hands']} sessions typed at least one command. {uname_only} of those are only uname. "
        "Those are one cluster of a single command. The sessions worth walking a customer through are the payloads.",
        color=QUIET,
    )
    pdf.h2("Payloads")
    pdf.table(
        ["When (UTC)", "Source", "Cluster", "What was captured"],
        [
            [
                case.started[:16].replace("T", " "),
                f"{case.src_ip} {case.src_country}",
                case.cluster_name,
                redact(", ".join(case.files[:2]) or "command only", 90),
            ]
            for case in payloads
        ],
        [32, 42, 58, 46],
    )
    pdf.h2("The worm, said once")
    pdf.body(
        f"{len(worm)} sessions from 130.12.180.51 (NL) share one shape: "
        "uname, echo, cd, echo, chmod, scp. The shell writes an SSH key into /tmp, "
        "copies a script from 217.60.103.56, and falls back to wget or curl piped into sh. "
        "The key material is not printed here."
    )
    pdf.table(
        ["What the attacker believed", "What happened"],
        [
            ["The login reached a shell.", "Cowrie answered. The host shell did not start."],
            ["scp, wget, or curl finished, and the script was ready to run.", "The bytes stayed in the Cowrie download directory."],
            ["The key file and the script were deleted at the end.", "The capture is still in the container. The management host did not execute it."],
        ],
        [89, 89],
    )
    pdf.body(
        "Three other payload shapes showed up once each: a German address writing authorized_keys, "
        "a Malaysian address running curl and apt, and a French address dropping a file in /tmp. "
        "Each left a hash in Cowrie's download directory.",
        color=QUIET,
    )
    pdf.output(path)


def write_sales(path: Path, built, paragraph: str) -> None:
    counts = Counter(case.verdict for case in built)
    hands = [case for case in built if case.verdict == "hands"]
    uname_only = sum(1 for case in hands if case.cluster_name == "uname")
    pdf = Doc("Hive  ·  how to sell  ·  26 Sep 2026")
    pdf.add_page()
    pdf.h1("How to sell Hive")
    pdf.body(
        "Sell a case file about one fake office. The customer does not buy a login to the console. "
        "They buy the morning paragraph, the payload cases, and the written lie: what the attacker believed, "
        "and what the container actually did.",
        color=QUIET,
    )
    pdf.stats(
        [
            (str(len(built)), "Sessions on this host"),
            (str(counts["payload"]), "Payload cases"),
            ("16", "Copies of one worm"),
            ("08:00", "MYT brief"),
        ]
    )
    pdf.h2("Who pays")
    pdf.body(
        "A small IT team or an MSSP that already has a jump host and wants a decoy of it. "
        "They pay for an office built in their names, and for the pack that arrives after 08:00 Malaysia time. "
        "They do not pay for a seat on the dashboard."
    )
    pdf.body(
        "T-Pot already ships a pile of listen ports. Thinkst already ships a token that phones home. "
        "A SIEM already counts alerts. Hive's opening is the session: a verdict, a cluster taken from this VLAN only, "
        "and a ledger of the lie."
    )
    pdf.h2("The fifteen minutes")
    pdf.table(
        ["Minute", "Do this", "Say this"],
        [
            ["0–2", "Open Cases. Read the overnight brief aloud.", paragraph],
            ["2–6", "Open one payload from 130.12.180.51.", "Sixteen sessions, one shape. This is their worm, not a feed."],
            ["6–10", "Read the two-column ledger.", "They thought the script ran. It is sitting in the Cowrie download directory."],
            ["10–13", "SSH to the decoy and cat the motd.", "The log-check line is today. Yesterday's visit would have shown a different line."],
            ["13–15", "Hand over the customer pack PDF.", "This is what you receive. You do not need a login on our management host."],
        ],
        [22, 62, 94],
    )
    pdf.h2("What you are honest about")
    pdf.body(
        f"{uname_only} of the {counts['hands']} command sessions are only uname. "
        "Call that a cluster of one command. Do not describe it as a person at the keyboard. "
        "The product is the 19 payload cases, and the fact that 16 of them are the same worm."
    )
    pdf.body(
        "If they ask for more bait protocols, the answer is that a longer port list is a different product, already sold by T-Pot and OpenCanary. "
        "If they ask for canary tokens, that is Thinkst's product. "
        "If they ask Hive to replace their SIEM, the answer is that Hive explains bait sessions."
    )
    pdf.h2("What you deliver")
    pdf.table(
        ["Piece", "Who keeps it", "Rule"],
        [
            ["Customer pack PDF", "The customer", "Forward this. It is the product."],
            ["Cases tab", "You, on the LAN", "Use it live in the demo. Do not ship the login."],
            ["kl-jump-01 files", "The bait VLAN", "Run living_office.py daily so the motd, ticket, and backup line move."],
            ["Dashboard :8443", "Management NIC only", "Do not forward it from the WAN. The API can restart the bait containers."],
        ],
        [42, 40, 96],
    )
    pdf.h2("Before the pilot")
    pdf.body(
        "Rename the office. Hostname, share names, ticket style, and the backup line should look like their jump host, with fictional staff only. "
        "Do not copy their real keys, VPN profiles, or passwords into honeyfs. "
        "Run python3 sensors/cowrie/living_office.py once a day. "
        "Rebuild this pack with python3 scripts/commercial_pdfs.py whenever the demo numbers should match the database."
    )
    pdf.body(
        "Charge for the office build and for the pack. A daily or weekly PDF is the subscription. "
        "A console login is not the line item.",
        style="I",
    )
    pdf.output(path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", type=Path, default=ROOT / "reports")
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    built, start, end, paragraph = load_cases()
    day = datetime.now(ZoneInfo("Asia/Kuala_Lumpur")).strftime("%Y-%m-%d")
    pack = args.out_dir / f"customer-pack-{day}.pdf"
    sales = args.out_dir / f"how-to-sell-{day}.pdf"
    write_customer_pack(pack, built, start, end, paragraph)
    write_sales(sales, built, paragraph)
    print(pack)
    print(sales)


if __name__ == "__main__":
    main()
