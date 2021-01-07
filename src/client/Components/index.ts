import button from './Button';
import singleSelect from './SingleSelect';

const win = window as unknown as Client.Window;
export function defineComponents(): void {
    win.app.components.set('button', button);
    win.app.components.set('single-select', singleSelect);
}