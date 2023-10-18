import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import notification from "./notification.json";
import pino from "pino";
import { STSClient, AssumeRoleCommand, Credentials } from "@aws-sdk/client-sts";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

dotenv.config();

const streams = [
  { stream: process.stdout },
  { stream: fs.createWriteStream("file.log", { flags: "a" }) },
];

const logger = pino(
  {
    name: "fh2",
    level: "debug",
  },
  pino.multistream(streams)
);

async function mediaFileDirectTransfer(): Promise<void> {
  try {
    const credentials = await getCredentialsFromAssumedRole();
    await uploadToS3(credentials);
    await sendNotification();
  } catch (error) {
    logger.error(error);
  }
}

async function getCredentialsFromAssumedRole(): Promise<Credentials> {
  const sts = new STSClient({
    region: process.env.REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const { Credentials } = await sts.send(
    new AssumeRoleCommand({
      RoleArn: process.env.ARN,
      RoleSessionName: process.env.ROLE_SESSION_NAME,
      Policy: process.env.POLICY,
    })
  );
  logger.info(Credentials);

  return Credentials;
}

async function uploadToS3(credentials: Credentials): Promise<void> {
  const s3 = new S3Client({
    region: process.env.REGION,
    credentials: {
      // with this we should get ACCESS DENIED
      // accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      // secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,

      // with this we should be able to upload to S3
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
    },
  });

  const response = await s3.send(
    new PutObjectCommand({
      Bucket: process.env.BUCKET,
      Key: "fh2.txt",
      Body: "Hello from FlighHub 2",
    })
  );

  logger.info(response);
}

async function sendNotification(): Promise<void> {
  const response = await axios.post(process.env.API_URL, notification);
  logger.info(response.data);
}

mediaFileDirectTransfer().then(() => logger.info("finished"));
