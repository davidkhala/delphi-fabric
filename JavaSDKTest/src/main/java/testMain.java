import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import model.AdminUser;
import model.ChannelUtil;
import org.hyperledger.fabric.sdk.*;
import org.hyperledger.fabric.sdk.exception.CryptoException;
import org.hyperledger.fabric.sdk.exception.InvalidArgumentException;
import org.hyperledger.fabric.sdk.exception.ProposalException;
import org.hyperledger.fabric.sdk.exception.TransactionException;
import org.hyperledger.fabric.sdk.security.CryptoSuite;

import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.security.NoSuchAlgorithmException;
import java.security.NoSuchProviderException;
import java.security.spec.InvalidKeySpecException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

public class testMain {


    static void joinPeer(Channel channel, Peer peer) throws ProposalException, InvalidArgumentException {

        try {
            channel.joinPeer(peer);
        } catch (ProposalException e) {
            if (e.getMessage().contains("status: 500, message: Cannot create ledger from genesis block, due to LedgerID already exists")) {
//                swallow
                channel.addPeer(peer);
                return;
            }
            throw e;
        }
    }

    public static Channel testPrepareChannel(String orgName) throws TransactionException, IOException, InvalidArgumentException, InvalidKeySpecException, NoSuchAlgorithmException, NoSuchProviderException, CryptoException {
        String channelName = "delphiChannel".toLowerCase();
        HFClient client = HFClient.createNewInstance();

        client.setCryptoSuite(CryptoSuite.Factory.getCryptoSuite());

        Map<String, String> msps = new HashMap<>();
        msps.put("BU", "BUMSP");
        msps.put("PM", "PMMSP");
        String company = "delphi";


        ClassLoader classLoader = ClassLoader.getSystemClassLoader();

        JsonObject orgsJson = new JsonParser().parse(new FileReader(new File(classLoader.getResource("orgs.json").getFile()))).getAsJsonObject();

        String cryptoRoot = orgsJson.getAsJsonObject(company).getAsJsonObject("docker").getAsJsonObject("volumes")
                .getAsJsonObject("MSPROOT").getAsJsonPrimitive("dir").getAsString();

        String configTxRoot = orgsJson.getAsJsonObject(company).getAsJsonObject("docker").getAsJsonObject("volumes")
                .getAsJsonObject("CONFIGTX").getAsJsonPrimitive("dir").getAsString();
        File channelFile = new File(configTxRoot, "delphi.channel");

        File adminMSPRoot = new File(cryptoRoot, "peerOrganizations/"+orgName+".Delphi.com/users/Admin@"+orgName+".Delphi.com/msp");
        AdminUser adminUser = new AdminUser(msps.get(orgName));
        adminUser.setEnrollment(adminMSPRoot);
        client.setUserContext(adminUser);

        return ChannelUtil.createOrGetChannel(client, channelName, "grpc://localhost:7250", channelFile);
    }
    public static void main(String[] args) {
        String channelName = "delphiChannel".toLowerCase();
        try {
            HFClient client = HFClient.createNewInstance();

            client.setCryptoSuite(CryptoSuite.Factory.getCryptoSuite());

            Map<String, String> msps = new HashMap<>();
            msps.put("BU", "BUMSP");
            msps.put("PM", "PMMSP");
            String company = "delphi";


            ClassLoader classLoader = ClassLoader.getSystemClassLoader();

            JsonObject orgsJson = new JsonParser().parse(new FileReader(new File(classLoader.getResource("orgs.json").getFile()))).getAsJsonObject();

            String cryptoRoot = orgsJson.getAsJsonObject(company).getAsJsonObject("docker").getAsJsonObject("volumes")
                    .getAsJsonObject("MSPROOT").getAsJsonPrimitive("dir").getAsString();

            String configTxRoot = orgsJson.getAsJsonObject(company).getAsJsonObject("docker").getAsJsonObject("volumes")
                    .getAsJsonObject("CONFIGTX").getAsJsonPrimitive("dir").getAsString();
            File channelFile = new File(configTxRoot, "delphi.channel");
            File genesisBlockFile = new File(configTxRoot, "delphi.block");

            File buAdminMSPRoot = new File(cryptoRoot, "peerOrganizations/BU.Delphi.com/users/Admin@BU.Delphi.com/msp");
            AdminUser buAdmin = new AdminUser(msps.get("BU"));
            buAdmin.setEnrollment(buAdminMSPRoot);
            client.setUserContext(buAdmin);


            Peer peer0BU = client.newPeer("peer0BU", "grpc://localhost:7051");
            Peer peer0PM = client.newPeer("peer0PM", "grpc://localhost:9051");
            Peer peer1BU = client.newPeer("peer1BU", "grpc://localhost:7061");

            Peer peer0ENG = client.newPeer("d", "grpc://localhost:8051");


            Channel channel = ChannelUtil.createOrGetChannel(client, channelName, "grpc://localhost:7250", channelFile);

            System.out.println("channel created");

            joinPeer(channel, peer0BU);
            channel.addEventHub(client.newEventHub("peer0BU","grpc://localhost:7053"));
            joinPeer(channel, peer1BU);
            channel.addEventHub(client.newEventHub("peer1BU","grpc://localhost:7063"));

            channel.initialize();// TODO double initialize to connect eventhub
            File pmAdminMSPRoot = new File(cryptoRoot, "peerOrganizations/PM.Delphi.com/users/Admin@PM.Delphi.com/msp");
            AdminUser pmAdmin = new AdminUser(msps.get("PM"));
            pmAdmin.setEnrollment(pmAdminMSPRoot);
            client.setUserContext(pmAdmin);

            joinPeer(channel, peer0PM);
            channel.addEventHub(client.newEventHub("peer0PM","grpc://localhost:9053"));

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

                testChaincode.ProposalResultWrapper resultWrapper = testChaincode.install(client, targets, chaincodeMetaData, GOPATH);
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
                testChaincode.ProposalResultWrapper instantiateResult = testChaincode.instantiate(channel, targets, chaincodeMetaData, new String[]{});
                if(instantiateResult.hasError()){
                    return;
                }
                System.out.println("init proposal" );
                BlockEvent.TransactionEvent instantiateEvent = channel.sendTransaction(instantiateResult.successResponses).get();
                System.out.println("["+instantiateEvent.getTransactionActionInfoCount()+"]"+instantiateEvent.getTransactionID()+instantiateEvent.getTimestamp());

//
                testChaincode.ProposalResultWrapper invokeResult = testChaincode.invoke(channel, targets, chaincodeMetaData, new String[]{});
                if(invokeResult.hasError()){
                    return;
                }
                System.out.println("invoke proposal");
                BlockEvent.TransactionEvent invokeEvent = channel.sendTransaction(invokeResult.successResponses).get();
                System.out.println("["+invokeEvent.getTransactionActionInfoCount()+"]"+invokeEvent.getTransactionID()+invokeEvent.getTimestamp());

            }


        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
