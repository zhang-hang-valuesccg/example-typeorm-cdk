#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { TypeormcdkStack } from "../lib/typeormcdk-stack";

const app = new cdk.App();
new TypeormcdkStack(app, "TypeormcdkStack", {
  // may need to provide env here
});
