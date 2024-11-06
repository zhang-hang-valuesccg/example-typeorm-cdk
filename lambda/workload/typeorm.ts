import { Handler } from "aws-lambda";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "../entity/User";
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

  const AppDataSource = new DataSource({
    type: "mysql",
    host: ENDPOINT,
    port: 3306,
    username: "admin",
    password: password,
    database: "test",
    synchronize: true,
    logging: false,
    entities: [User],
    migrations: [],
    subscribers: [],
  });

  try {
    await AppDataSource.initialize();

    // new user entry
    const user = new User();
    user.Name = "test";
    user.age = 1;

    await AppDataSource.manager.save(user);

    const users = await AppDataSource.manager.find(User);

    console.log(`users: ${JSON.stringify(users)}`);
  } catch (err) {
    throw Error(`ERROR: ${err}`);
  }
};
