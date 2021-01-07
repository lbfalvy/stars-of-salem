import findPlugins from 'find-plugins';

export default function loadPlugins(): Array<Server.Plugin> {
    //const require: NodeRequire = eval('require');
    console.info(`Scanning for plugins in ${process.cwd()}...`);
    const plugins = findPlugins({
        sort: true,
        keyword: 'pages-engine',
        dir: './node_modules',
        scanAllDirs: true // Load any plugin, not just dependencies
    });
    console.info('Loading plugins...');
    const plugin_objects = plugins.map(plugin => {
        console.info('Loading', plugin.pkg.name);
        return require(plugin.pkg.name);
    }); // Load the packages properly
    console.info('Plugin loading finished');
    return plugin_objects;
}