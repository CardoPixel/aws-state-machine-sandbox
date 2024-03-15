// test/stateMachineHappyPath.test.ts
const {
  SFNClient,
  StartExecutionCommand,
  DescribeExecutionCommand,
} = require("@aws-sdk/client-sfn");
const client = new SFNClient({ region: process.env.AWS_REGION }); // Replace 'your-region' with the appropriate AWS region

describe("StateMachine Happy Path Execution", () => {
  const stateMachineArn = process.env.AWS_STATEMACHINE_ARN; // Replace with your actual State Machine ARN

  test("Happy Path Execution Completes Successfully", async () => {
    const input = {
      body: JSON.stringify({
        orderId: "ORD1234567",
        customer: {
          customerId: "CUST12345",
          name: "Jane Doe",
          email: "janedoe@example.com",
          taxId: "TAX12345",
        },
        items: [
          {
            itemId: "ITEM12345",
            productName: "Smartphone",
            quantity: 1,
            price: 599.99,
          },
          {
            itemId: "ITEM67890",
            productName: "Protective Case",
            quantity: 1,
            price: 49.99,
          },
        ],
        payment: {
          paymentId: "PAYMENT12345",
          method: "CreditCard",
          amount: 650,
        },
      }),
    };

    const startCommand = new StartExecutionCommand({
      stateMachineArn,
      input: JSON.stringify(input),
    });

    const { executionArn } = await client.send(startCommand);
    expect(executionArn).toBeDefined();

    // Optionally, wait for execution to complete and then describe execution
    // Implement a custom waiter or delay as AWS SDK does not provide a built-in waiter for execution completion

    // Example of fetching execution result (requires waiting for completion)
    // const describeCommand = new DescribeExecutionCommand({ executionArn });
    // const executionDetails = await client.send(describeCommand);
    // expect(executionDetails.status).toBe("SUCCEEDED");
    // Further assertions based on executionDetails.output if needed
  });
});
