import { render } from 'preact';
import { App } from './app';
import './ui.css';
import { startNative } from './native';

startNative();

render(<App />, document.getElementById('app')!);
