import findPlugins from 'find-plugins';
import { Device } from './GameElements';

export interface Plugin {
    devices: Array<Device>;
}

export default function loadPlugins():Array<Plugin> {
    const require:NodeRequire = eval('require');
    const plugins = findPlugins({
        scanAllDirs: true // Load any plugin, not just dependencies
    });

    return plugins.map(plugin => require(plugin.pkg.name)); // Load the packages properly
}