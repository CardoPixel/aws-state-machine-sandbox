// test/aws-state-machine-sandbox.test.ts
import { App } from "aws-cdk-lib";
import { Template, Match } from "@aws-cdk/assertions";
import { AwsStateMachineSandboxStack } from "../lib/aws-state-machine-sandbox-stack";

describe("AwsStateMachineSandboxStack", () => {
  let app: App;
  let stack: AwsStateMachineSandboxStack;
  let template: Template;

  beforeAll(() => {
    app = new App();
    stack = new AwsStateMachineSandboxStack(app, "MyTestStack");
    template = Template.fromStack(stack as any);
  });

  test("DynamoDB Table Created With Correct Billing Mode", () => {
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      BillingMode: "PAY_PER_REQUEST",
    });
  });

  test("Lambda Functions Are Created", () => {
    template.resourceCountIs("AWS::Lambda::Function", 4); // Assuming you have 4 Lambda functions
  });

  test("StateMachine Is Created", () => {
    template.resourceCountIs("AWS::StepFunctions::StateMachine", 1);
  });

  test("ProcessOrder Lambda Has Correct Environment Variables", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: Match.objectLike({
          TABLE_NAME: Match.anyValue(),
        }),
      },
      Handler: "processOrder.handler",
    });
  });
});
