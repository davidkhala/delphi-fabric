package model;

import org.hyperledger.fabric.sdk.Enrollment;
import org.hyperledger.fabric.sdk.User;

import java.io.File;
import java.io.IOException;
import java.security.NoSuchAlgorithmException;
import java.security.NoSuchProviderException;
import java.security.spec.InvalidKeySpecException;
import java.util.Set;

public class AdminUser implements User {

    final String MspId;
    Enrollment enrollment;
    public AdminUser(String mspId) {
        MspId = mspId;
    }

    public void setEnrollment(File mspDir) throws InvalidKeySpecException, NoSuchAlgorithmException, NoSuchProviderException, IOException {

        if(mspDir.isDirectory()){
            File privateKeyFile = EnrollmentFromFile.findFileSk(new File(mspDir,"keystore"));
            File certificateFile = new File(mspDir,"signcerts").listFiles()[0];
            EnrollmentFromFile enrollmentFromFile = new EnrollmentFromFile(privateKeyFile,certificateFile);
            this.setEnrollment(enrollmentFromFile);
        }
    }
    public void setEnrollment(Enrollment enrollment) {
        this.enrollment = enrollment;
    }

    @Override
    public String getName() {
        return "Admin";
    }

    @Override
    public Set<String> getRoles() {
        return null;
    }

    @Override
    public String getAccount() {
        return null;
    }

    @Override
    public String getAffiliation() {
        return null;
    }

    @Override
    public Enrollment getEnrollment() {
        return enrollment;
    }

    @Override
    public String getMspId() {
        return MspId;
    }
}
