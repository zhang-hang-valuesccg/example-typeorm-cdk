import { Handler } from "aws-lambda";
import * as mysql from "mysql2/promise";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const secret_name = "rds-password";

const clientSecret = new SecretsManagerClient({
  region: "ap-northeast-1",
});

const ENDPOINT = process.env.ENDPOINT || "";

export const handler: Handler = async (event) => {
  let password;
  try {
    const getSecretCommand = new GetSecretValueCommand({
      SecretId: secret_name,
      VersionStage: "AWSCURRENT",
    });
    const response = await clientSecret.send(getSecretCommand);
    const secretStr = response.SecretString;

    if (!secretStr) throw Error("invalid secret");

    const secrets = JSON.parse(secretStr);

    password = secrets["password"];
  } catch (err) {
    console.log(err);
  }

  const dbConfig = {
    host: ENDPOINT,
    user: "admin",
    password: password,
    port: 3306,
  };

  try {
    const conn = await mysql.createConnection(dbConfig);

    const [results, fields] = await conn.query("SHOW TABLES FROM mysql");

    console.log(results);

    await conn.query("CREATE DATABASE IF NOT EXISTS test");
  } catch (err) {
    throw Error(`ERROR: ${err}`);
  }
};
