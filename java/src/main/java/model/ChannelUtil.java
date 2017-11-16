package model;

import org.hyperledger.fabric.sdk.Channel;
import org.hyperledger.fabric.sdk.ChannelConfiguration;
import org.hyperledger.fabric.sdk.HFClient;
import org.hyperledger.fabric.sdk.exception.InvalidArgumentException;
import org.hyperledger.fabric.sdk.exception.TransactionException;

import java.io.File;
import java.io.IOException;
import java.lang.reflect.Field;

public class ChannelUtil {

    public static HFClient getClient(Channel channel) throws NoSuchFieldException, IllegalAccessException {
        //        fixme: not getter for client in channel
        Field f = Channel.class.getDeclaredField("client"); //NoSuchFieldException
        f.setAccessible(true);
        return (HFClient) f.get(channel);
    }

    /**
     *
     * @param client
     * @param channelName
     * @param grpcURL grpc://localhost:7250
     * @param channelFile
     * @return
     * @throws InvalidArgumentException
     * @throws IOException
     * @throws TransactionException
     */
    public static Channel createOrGetChannel(HFClient client, String channelName, String grpcURL, File channelFile) throws InvalidArgumentException, IOException, TransactionException {
        Channel channel;
        try {
            channel = client.newChannel(channelName).addOrderer(client.newOrderer("fine", grpcURL));
            channel = channel.initialize();
        } catch (TransactionException e) {
            e.printStackTrace();
            ChannelConfiguration channelConfiguration = new ChannelConfiguration(channelFile);
            client.newChannel(channelName, client.newOrderer("fine", grpcURL), channelConfiguration, client.getChannelConfigurationSignature(channelConfiguration, client.getUserContext()));
            channel = getChannelLoop(client,channelName,grpcURL);
        }
        return channel;
    }

    static Channel getChannelLoop(HFClient client, String channelName, String grpcURL) throws InvalidArgumentException, IOException, TransactionException {
        Channel channel;
        try {
            channel = client.newChannel(channelName).addOrderer(client.newOrderer("fine", grpcURL));
            channel = channel.initialize();
        } catch (TransactionException e) {
            channel = getChannelLoop(client,channelName,grpcURL);
        }
        return channel;
    }
}
