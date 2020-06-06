export class ConnectionProvider {
    static connections: string[] = [];

    static forHosts(hosts: string[]): ConnectionProvider {
        ConnectionProvider.connections = hosts;

        return new ConnectionProvider();
    }
}
