export function HudFrame() {
  return (
    <div className="hud-frame" aria-hidden="true">
      <span className="hud-bracket hud-tl" />
      <span className="hud-bracket hud-tr" />
      <span className="hud-bracket hud-bl" />
      <span className="hud-bracket hud-br" />
      <div className="hud-scanlines" />
    </div>
  );
}
