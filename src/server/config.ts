import { program } from 'commander';

program
.option('-p, --port <port>', 
        'port for the game', 
        val => Number.parseInt(val), 8080)
.option('-ctu, --connection-timeout <ms>',
        'Connection timeout in miliseconds (determines ping frequency)', 
        val => Number.parseInt(val), 1000)
.option('-stu, --session-timeout <sec>',
        'Session timeout in seconds', 
        val => Number.parseFloat(val), 60)
.parse();

export default {
    port: program.port,
    connectionTimeout: program.connectionTimeout,
    sessionTimeout: program.sessionTimeout * 1000
};