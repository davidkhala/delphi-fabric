
## Notes

For [channelConfigUpdate], usually we need orderer admin identity to view and operate configuration related to orderer, even for application channel
Please apply all [channelConfigUpdate] to a single orderer during migration steps   


## Migration steps

1. [channelConfigUpdate] change system channel to `STATE_MAINTENANCE`, and repeat it on each channel
     
2. Backup files and shut down servers
    1. stop orderers 
    2. sleep ~30s
    3. stop kafkas
    4. stop zookeepers
    4. create a backup of all orderers, kafkas and zookeepers
    5. restart zookeepers
    6. restart kafkas
    7. restart orderers
3. [channelConfigUpdate] switch `Type` to `etcdraft` and fill in the `Metadata` configuration​ for system channel and repeat it on each channel
    - the transaction that changes the ConsensusType must be the last configuration transaction per channel before restarting the nodes
4. Restart and validate leader
    1. stop orderers
    2. stop kafkas 
    3. stop zookeepers
    4. restart only the orderers with additional environment set, at least including
        ```shell script
                General.Cluster.ClientCertificate = ""
                General.Cluster.ClientPrivateKey = ""
                General.Cluster.RootCAs = []
        ```
    5. sleep ~2s; then validate that a leader has been elected on each channel by inspecting the node logs. 
    ```shell script
    2019-05-26 10:07:44.075 UTC [orderer.consensus.etcdraft] serveRequest -> INFO 047 Raft leader changed: 0 -> 1 channel=testchannel1 node=2
    ```
5. [channelConfigUpdate] change system channel to `STATE_NORMAL`, and repeat it on each channel

## Abort and rollback
There are a few states which might indicate migration has failed:

    Some nodes crash or shutdown.
    There is no record of a successful leader election per channel in the logs.
    The attempt to flip to NORMAL mode on the system channel fails.

If a problem emerges during the migration process before exiting maintenance mode, simply perform the rollback procedure below.
    1. stop orderers 
    2. sleep ~30s
    3. stop kafkas
    4. stop zookeepers
    5. restart zookeepers with backup
    6. restart kafkas with backup
    7. restart orderers with backup, the ordering nodes will bootstrap to Kafka in maintenance mode.
    8. [channelConfigUpdate] change system channel to `STATE_NORMAL`, and repeat it on each channel


