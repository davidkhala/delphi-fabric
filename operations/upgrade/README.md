The instructions in this documentation cover moving from v1.3 to v1.4.x or from an earlier version of v1.4.x to a later version to v1.4.x.
At a high level, it can be performed by following these steps:

- Upgrade the binaries for the ordering service, the Fabric CA, and the peers. These upgrades may be done in parallel.
- Upgrade client SDKs.
- If upgrading to +v1.4.2, enable the v1.4.2 channel capabilities.
- (Optional) Upgrade the Kafka cluster.

we have included a section at the end of the tutorial that will show how to upgrade your CA, Kafka clusters, CouchDB, Zookeeper, vendored chaincode shims, and Node SDK clients.


Specifically, the v1.4.2 capabilities enable the following features:
- Migration from Kafka to Raft consensus (requires v1.4.2 orderer and channel capabilities)
- Ability to specify orderer endpoints per organization (requires v1.4.2 channel capability)
- Ability to store private data for invalidated transactions (requires v1.4.2 application capability)
