/** Renders parser errors (or a success line). */
export default function ValidationMessages({ errors = [], ok = false, okText = 'Input is valid.' }) {
  if (!errors.length && !ok) return null;
  return (
    <ul className="messages" aria-live="polite">
      {errors.map((e, i) => (
        <li key={i} className="msg msg-error">
          {e.line > 0 && <span className="line">L{e.line}</span>}
          <span>{e.msg}</span>
        </li>
      ))}
      {ok && !errors.length && <li className="msg msg-ok">✓ {okText}</li>}
    </ul>
  );
}
