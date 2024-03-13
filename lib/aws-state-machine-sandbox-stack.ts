// lib/aws-state-machine-sandbox-stack.ts
import {
  CfnOutput,
  Stack,
  StackProps,
  aws_lambda as lambda,
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as tasks,
  aws_dynamodb as dynamodb,
} from "aws-cdk-lib";
import { Construct } from "constructs";

export class AwsStateMachineSandboxStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const orderTable = new dynamodb.Table(this, "OrderTable", {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Lambda functions setup
    const validateOrderLambda = this.createLambdaFunction(
      "ValidateOrderFunction",
      "validateOrder.handler",
      orderTable
    );
    orderTable.grantReadWriteData(validateOrderLambda);

    const processOrderLambda = this.createLambdaFunction(
      "ProcessOrderFunction",
      "processOrder.handler",
      orderTable
    );
    orderTable.grantReadWriteData(processOrderLambda);

    const cancelOrderLambda = this.createLambdaFunction(
      "CancelOrderFunction",
      "cancelOrder.handler",
      orderTable
    );
    orderTable.grantReadWriteData(cancelOrderLambda);

    const paymentLambda = this.createLambdaFunction(
      "PaymentFunction",
      "payment.handler",
      orderTable
    );
    orderTable.grantReadWriteData(paymentLambda);

    const refundPaymentLambda = this.createLambdaFunction(
      "RefundPaymentFunction",
      "refundPayment.handler",
      orderTable
    );
    orderTable.grantReadWriteData(refundPaymentLambda);

    const verifyOrderPaymentLambda = this.createLambdaFunction(
      "VerifyOrderPaymentFunction",
      "verifyOrderPayment.handler",
      orderTable
    );
    orderTable.grantReadWriteData(verifyOrderPaymentLambda);

    // Define the Step Functions tasks
    const validateOrderTask = new tasks.LambdaInvoke(
      this,
      "Validate Order Task",
      {
        lambdaFunction: validateOrderLambda,
        inputPath: "$",
        resultPath: "$.validationResult",
      }
    );

    const cancelOrderTask = new tasks.LambdaInvoke(this, "Cancel Order Task", {
      lambdaFunction: cancelOrderLambda,
      resultPath: "$.cancelOrderResult",
    });

    const processOrderTask = new tasks.LambdaInvoke(
      this,
      "Process Order Task",
      {
        lambdaFunction: processOrderLambda,
        resultPath: "$.processOrderResult",
      }
    ).addCatch(cancelOrderTask);

    const refundPaymentTask = new tasks.LambdaInvoke(
      this,
      "Refund Payment Task",
      {
        lambdaFunction: refundPaymentLambda,
        inputPath: "$.verificationResult.Payload", // Adjust according to your Lambda's expected input
        resultPath: "$.refundResult",
      }
    );

    const paymentTask = new tasks.LambdaInvoke(this, "Payment Task", {
      lambdaFunction: paymentLambda,
      inputPath: "$.processOrderResult.Payload", // Adjust according to your Lambda's expected input
      resultPath: "$.paymentResult",
    }).addCatch(cancelOrderTask);

    const verifyOrderPaymentTask = new tasks.LambdaInvoke(
      this,
      "Verify Order Payment Task",
      {
        lambdaFunction: verifyOrderPaymentLambda,
        inputPath: "$.paymentResult.Payload", // Adjust according to your Lambda's expected input
        resultPath: "$.verificationResult",
      }
    ).addCatch(cancelOrderTask);

    // Branching logic based on verification results
    const isOverpaid = sfn.Condition.stringEquals(
      "$.verificationResult.Payload.status",
      "OVERPAID"
    );

    // Define end states for clarity and use within the state machine
    const paymentSuccess = new sfn.Succeed(this, "Payment Success");
    const validationFailed = new sfn.Fail(this, "Validation Failed", {
      cause: "Validation failed",
      error: "Order details did not pass validation",
    });

    // Defining the state machine's logic
    const definition = validateOrderTask.next(
      new sfn.Choice(this, "Validate Order")
        // Condition to check if the validation passed or failed
        .when(
          sfn.Condition.stringEquals(
            "$.validationResult.Payload.validationStatus",
            "FAILED"
          ),
          validationFailed
        ) // End the execution if validation fails
        .otherwise(
          processOrderTask
            .next(paymentTask) // If validation passes, proceed with processing the order
            .next(verifyOrderPaymentTask)
            .next(
              new sfn.Choice(this, "Check Payment Outcome")
                .when(isOverpaid, refundPaymentTask) // Decide based on payment verification
                .otherwise(paymentSuccess)
            )
        )
    );

    const saga = new sfn.StateMachine(this, "SagaPatternStateMachine", {
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      stateMachineType: sfn.StateMachineType.STANDARD,
    });

    new CfnOutput(this, "StateMachineArn", {
      value: saga.stateMachineArn,
      description: "The ARN of the Saga Pattern State Machine",
      exportName: "SagaPatternStateMachineArn",
    });
  }

  createLambdaFunction(
    id: string,
    handler: string,
    orderTable: dynamodb.Table
  ): lambda.Function {
    return new lambda.Function(this, id, {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: handler,
      code: lambda.Code.fromAsset("lambda"),
      environment: {
        TABLE_NAME: orderTable.tableName,
      },
    });
  }
}
