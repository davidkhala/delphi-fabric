import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.hyperledger.fabric.fabricCommon.AdminUser;
import org.hyperledger.fabric.fabricCommon.ChannelUtil;
import org.hyperledger.fabric.sdk.*;
import org.hyperledger.fabric.sdk.security.CryptoSuite;

import java.io.File;
import java.io.FileReader;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class testMain {


    public static void main(String[] args) {
        String channelName = "allchannel";
        try {
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
            File channelFile = new File(configTxRoot, "delphi.tx");
            File genesisBlockFile = new File(configTxRoot, "delphi.block");

            File buAdminMSPRoot = new File(cryptoRoot, "peerOrganizations/BU.Delphi.com/users/Admin@BU.Delphi.com/msp");
            AdminUser buAdmin = new AdminUser(msps.get("BU"));
            buAdmin.setEnrollment(buAdminMSPRoot);
            client.setUserContext(buAdmin);


            Peer peer0BU = client.newPeer("peer0BU", "grpc://localhost:7051");
            Peer peer0PM = client.newPeer("peer0PM", "grpc://localhost:9051");
            Peer peer1BU = client.newPeer("peer1BU", "grpc://localhost:7061");

            Peer peer0ENG = client.newPeer("d", "grpc://localhost:8051");


            Channel channel = ChannelUtil.createOrGetChannel(client, channelName, "grpc://localhost:7050", channelFile);

            System.out.println("channel created");

            ChannelUtil.joinPeer(channel, peer0BU);
            channel.addEventHub(client.newEventHub("peer0BU", "grpc://localhost:7053"));
            ChannelUtil.joinPeer(channel, peer1BU);
            channel.addEventHub(client.newEventHub("peer1BU", "grpc://localhost:7063"));

            channel.initialize();// TODO double initialize to connect eventhub
            File pmAdminMSPRoot = new File(cryptoRoot, "peerOrganizations/PM.Delphi.com/users/Admin@PM.Delphi.com/msp");
            AdminUser pmAdmin = new AdminUser(msps.get("PM"));
            pmAdmin.setEnrollment(pmAdminMSPRoot);
            client.setUserContext(pmAdmin);

            ChannelUtil.joinPeer(channel, peer0PM);
            channel.addEventHub(client.newEventHub("peer0PM", "grpc://localhost:9053"));

            channel.initialize();// TODO double initialize to connect eventhub
            {
                JsonObject chaincodeJson = new JsonParser().parse(new FileReader(new File(classLoader.getResource("chaincode.json").getFile()))).getAsJsonObject();


                String ccName = "adminChaincode";
                String ccVersion = "v0";
                String ccPath = chaincodeJson.getAsJsonObject("chaincodes").getAsJsonObject(ccName).getAsJsonPrimitive("path").getAsString();
                ChaincodeID chaincodeMetaData = ChaincodeID.newBuilder().setName(ccName).setVersion(ccVersion).setPath(ccPath).build();
                String GOPATH = chaincodeJson.getAsJsonPrimitive("GOPATH").getAsString();
                Set<Peer> targets = new HashSet<>();
                targets.add(peer0PM);

                Chaincode.ProposalResultWrapper resultWrapper = Chaincode.install(client, targets, chaincodeMetaData, GOPATH);
                if (resultWrapper.hasError()) {
                    for (ProposalResponse failureResponse : resultWrapper.failureResponses) {
                        System.out.println("joinPeer failed on " + failureResponse.getPeer().getUrl());// TODO
                    }
                }
//                FIXME: blockListener not working


//                channel.registerBlockListener(blockEvent -> {
//                    System.out.println("blockEvent Come");
//                    blockEvent.getTransactionEvents().forEach(
//                            transactionEvent -> {
//                                if(transactionEvent.isValid()){
//
//                                    System.out.println("trasaction Event"+transactionEvent.getTransactionID());
//                                }else {
//                                    System.err.println("trasaction Event"+transactionEvent.getTransactionID());
//                                }
//                            }
//                    );
//                });
                Chaincode.ProposalResultWrapper instantiateResult = Chaincode.instantiate(channel, targets, chaincodeMetaData, new String[]{});
                if (instantiateResult.hasError()) {
                    return;
                }
                System.out.println("init proposal");
                BlockEvent.TransactionEvent instantiateEvent = channel.sendTransaction(instantiateResult.successResponses).get();
                System.out.println("[" + instantiateEvent.getTransactionActionInfoCount() + "]" + instantiateEvent.getTransactionID() + instantiateEvent.getTimestamp());

//
                Chaincode.ProposalResultWrapper invokeResult = Chaincode.invoke(channel, targets, chaincodeMetaData, new String[]{});
                if (invokeResult.hasError()) {
                    return;
                }
                System.out.println("invoke proposal");
                BlockEvent.TransactionEvent invokeEvent = channel.sendTransaction(invokeResult.successResponses).get();
                System.out.println("[" + invokeEvent.getTransactionActionInfoCount() + "]" + invokeEvent.getTransactionID() + invokeEvent.getTimestamp());

            }


        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
