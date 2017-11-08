import model.ChannelUtil;
import org.hyperledger.fabric.protos.peer.Query;
import org.hyperledger.fabric.sdk.BlockchainInfo;
import org.hyperledger.fabric.sdk.Channel;
import org.hyperledger.fabric.sdk.HFClient;
import org.hyperledger.fabric.sdk.Peer;

import java.util.List;

public class testQuery {

    public static void main(String[] args) {
        try {
            String orgName = "PM";
            Channel channel = testMain.testPrepareChannel(orgName);
            HFClient client = ChannelUtil.getClient(channel);
            Peer peer0PM = client.newPeer("b", "grpc://localhost:9051");
            testMain.joinPeer(channel, peer0PM);

            List<Query.ChaincodeInfo> installedInfo = client.queryInstalledChaincodes(peer0PM);
            System.out.println("installed chaincodes:"+installedInfo.size());
            List<Query.ChaincodeInfo> ccinfoList = channel.queryInstantiatedChaincodes(peer0PM);
            System.out.println("instantiated chaincodes:"+ccinfoList.size());

            BlockchainInfo blockchainInfo =  channel.queryBlockchainInfo(peer0PM);
            System.out.println("block Height:"+blockchainInfo.getHeight());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
