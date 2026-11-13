import { AlarmCheck } from './Alarms';

/** Everything that is not a daily screen: calculator, help, sync, the Android app and the alarm check. */
export function More() {
  return (
    <main>
      <div>
        <span class="sub">עוד</span>
        <h1>עוד</h1>
      </div>
      <AlarmCheck />
      <a class="btn" href="#/calc">מחשבון סטארטר</a>
      <a class="btn" href="#/starter">מצב הסטארטר שלי</a>
      <a class="btn" href="#/help">עזרה ומדריך</a>
      <a class="btn" href="#/app">הורדת אפליקציית אנדרואיד</a>
      <a class="btn" href="#/sync">סנכרון עם Google Drive</a>
    </main>
  );
}
