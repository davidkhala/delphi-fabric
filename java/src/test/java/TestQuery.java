import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.hyperledger.fabric.fabricCommon.AdminUser;
import org.hyperledger.fabric.fabricCommon.ChannelUtil;
import org.hyperledger.fabric.protos.peer.Query;
import org.hyperledger.fabric.sdk.BlockchainInfo;
import org.hyperledger.fabric.sdk.Channel;
import org.hyperledger.fabric.sdk.HFClient;
import org.hyperledger.fabric.sdk.Peer;
import org.hyperledger.fabric.sdk.exception.CryptoException;
import org.hyperledger.fabric.sdk.exception.InvalidArgumentException;
import org.hyperledger.fabric.sdk.exception.TransactionException;
import org.hyperledger.fabric.sdk.security.CryptoSuite;

import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.security.NoSuchAlgorithmException;
import java.security.NoSuchProviderException;
import java.security.spec.InvalidKeySpecException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class TestQuery {

    public static void main(String[] args) {
        try {
            String orgName = "PM";

            Channel channel = testPrepareChannel(orgName,"delphi.tx");
            HFClient client = ChannelUtil.getClient(channel);
            Peer peer0PM = client.newPeer("b", "grpc://localhost:9051");
            ChannelUtil.joinPeer(channel, peer0PM);

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

    public static Channel testPrepareChannel(String orgName,String channelFilename) throws TransactionException, IOException, InvalidArgumentException, InvalidKeySpecException, NoSuchAlgorithmException, NoSuchProviderException, CryptoException, ClassNotFoundException, NoSuchMethodException, InvocationTargetException, InstantiationException, IllegalAccessException {
        String channelName = "allchannel";
        HFClient client = HFClient.createNewInstance();

        client.setCryptoSuite(CryptoSuite.Factory.getCryptoSuite());

        Map<String, String> msps = new HashMap<>();
        msps.put("BU", "BUMSP");
        msps.put("PM", "PMMSP");


        ClassLoader classLoader = ClassLoader.getSystemClassLoader();

        JsonObject orgsJson = new JsonParser().parse(new FileReader(new File(classLoader.getResource("orgs.json").getFile()))).getAsJsonObject();

        String cryptoRoot = orgsJson.getAsJsonObject("docker").getAsJsonObject("volumes")
                .getAsJsonObject("MSPROOT").getAsJsonPrimitive("dir").getAsString();

        String configTxRoot = orgsJson.getAsJsonObject("docker").getAsJsonObject("volumes")
                .getAsJsonObject("CONFIGTX").getAsJsonPrimitive("dir").getAsString();
        File channelFile = new File(configTxRoot,channelFilename);
        File adminMSPRoot = new File(cryptoRoot, "peerOrganizations/"+orgName+".Delphi.com/users/Admin@"+orgName+".Delphi.com/msp");
        AdminUser adminUser = new AdminUser(msps.get(orgName));
        adminUser.setEnrollment(adminMSPRoot);
        client.setUserContext(adminUser);

        return ChannelUtil.createOrGetChannel(client, channelName, "grpc://localhost:7050", channelFile);
    }
}
