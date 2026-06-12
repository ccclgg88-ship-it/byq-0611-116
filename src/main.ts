import { App } from './App';
import './styles.css';

const mount = document.getElementById('app');
if (!mount) {
  throw new Error('未找到挂载点 #app');
}

const app = new App(mount);
app.start().catch((err) => {
  console.error('[App] 启动失败:', err);
  mount.innerHTML = `<div style="padding:24px;font-family:system-ui;color:#b00020">
    <h2>应用启动失败</h2>
    <pre>${err instanceof Error ? err.message : String(err)}</pre>
  </div>`;
});
