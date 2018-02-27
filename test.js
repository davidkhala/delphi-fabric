const Logger = require('./app/util/logger')
// Logger.setGlobal();
const Helper = require('./app/helper');
const ClientUtil = require('./app/util/client')
// Helper.getOrgAdmin('BU').then((client)=>{
//
// })
const winstonLoggerTest =()=>{
    var sdkUtils = require('fabric-client/lib/utils');
    const winstonLogger = sdkUtils.getLogger("winston");
    const name = "name"
    winstonLogger.error('a %s',(typeof name),{b:'B'},'c')
}

// winstonLoggerTest()
const pem='-----BEGIN CERTIFICATE-----\n' +
    'MIICMDCCAdegAwIBAgIQIUSYXiwb8BIf+zkJkcjnpTAKBggqhkjOPQQDAjBqMQsw\n' +
    'CQYDVQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5pYTEWMBQGA1UEBxMNU2FuIEZy\n' +
    'YW5jaXNjbzETMBEGA1UEChMKRGVscGhpLmNvbTEZMBcGA1UEAxMQdGxzY2EuRGVs\n' +
    'cGhpLmNvbTAeFw0xODAyMTMwMTQ5MjRaFw0yODAyMTEwMTQ5MjRaMGoxCzAJBgNV\n' +
    'BAYTAlVTMRMwEQYDVQQIEwpDYWxpZm9ybmlhMRYwFAYDVQQHEw1TYW4gRnJhbmNp\n' +
    'c2NvMRMwEQYDVQQKEwpEZWxwaGkuY29tMRkwFwYDVQQDExB0bHNjYS5EZWxwaGku\n' +
    'Y29tMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE9UcO0O/6zx4WFuWvyVCWnudl\n' +
    'f7TuthAzY25H8vEfVOJ/Uy+Z8XK25Z0jLvE8iq6RiZkX6YkZupvfFr9hr58D4KNf\n' +
    'MF0wDgYDVR0PAQH/BAQDAgGmMA8GA1UdJQQIMAYGBFUdJQAwDwYDVR0TAQH/BAUw\n' +
    'AwEB/zApBgNVHQ4EIgQgOUl2LsCicoKz/5EzfFPnSVahaZxcpeSSd+vtStyjf7Yw\n' +
    'CgYIKoZIzj0EAwIDRwAwRAIgWeMGmyUxWXdKVJb3tN2hnR0aBDKWSAjwXdKwVxqx\n' +
    'LvwCIGUx9a0sITIRksSWZoNm0nkgSPlhEmsPlZ6WpoNn9P05\n' +
    '-----END CERTIFICATE-----\n';

const pemToDER = (pem)=>{

    //PEM format is essentially a nicely formatted base64 representation of DER encoding
    //So we need to strip "BEGIN" / "END" header/footer and string line breaks
    //Then we simply base64 decode it and convert to hex string
    var contents = pem.toString().trim().split(/\r?\n/);
    //check for BEGIN and END tags
    if (!(contents[0].match(/-----s*BEGIN ?([^-]+)?-----/) &&
            contents[contents.length - 1].match(/-----s*END ?([^-]+)?-----/))) {
        throw new Error('Input parameter does not appear to be PEM-encoded.');
    }
    contents.shift(); //remove BEGIN
    contents.pop(); //remove END
    //base64 decode and encode as hex string
    var hex = Buffer.from(contents.join(''), 'base64').toString('hex');
    return hex;
}

const hex =pemToDER(pem);
const TestClassB = require('./testClassB');
const obj = new TestClassB('hashHex');
obj.print()
