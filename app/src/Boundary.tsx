import { Component, type ComponentChildren } from 'preact';

/** A screen that throws must not freeze the app: show a message and keep the tabs working. */
export class Boundary extends Component<{ children: ComponentChildren; resetKey: string; quiet?: boolean }, { error: string | null; key: string }> {
  state = { error: null as string | null, key: this.props.resetKey };
  static getDerivedStateFromProps(p: { resetKey: string }, s: { error: string | null; key: string }) {
    return p.resetKey !== s.key ? { error: null, key: p.resetKey } : null; // another screen: try again
  }
  componentDidCatch(e: unknown) {
    this.setState({ error: e instanceof Error ? e.message : String(e) });
  }
  render() {
    if (this.state.error === null) return this.props.children;
    if (this.props.quiet) return null;
    return (
      <main>
        <section class="crash" role="alert">
          <strong>משהו השתבש במסך הזה</strong>
          <span class="muted">אפשר לעבור למסך אחר בלשוניות למטה. אם זה חוזר, שלח לי את ההודעה: {this.state.error}</span>
          <a class="btn small" href="#/" style="display:flex;justify-content:center;text-decoration:none;color:inherit">לבית</a>
        </section>
      </main>
    );
  }
}
