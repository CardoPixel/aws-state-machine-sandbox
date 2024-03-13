// lambda/processOrder.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDB } from "aws-sdk";

// Initialize DynamoDB Document Client
const ddb = new DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME || ""; // DynamoDB Table Name

/**
 * A Lambda function to process an order.
 *
 * @param event - The Lambda event containing the order details.
 * @returns The API Gateway response.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Assuming order details are passed in the body of the request
  let order: {
    orderId: string;
    customer: {
      customerId: string;
      name: string;
      email: string;
      taxId: string;
    };
    items: Array<{
      itemId: string;
      productName: string;
      quantity: number;
      price: number;
    }>;
    payment: {
      paymentId: string;
      method: string;
      amount: number;
    };
  };
  try {
    order = JSON.parse(event.body || "{}");
    console.log("Order details:", order);
  } catch (error) {
    console.error("Error parsing order details:", error);
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Invalid JSON format. Details: " + error,
      }),
    };
  }

  // Validate order items
  if (
    !order.orderId ||
    !order.items ||
    order.items.length === 0 ||
    !order.customer ||
    !order.customer.customerId
  ) {
    console.error(
      "Validation failed: Order ID, items and customer data are required."
    );
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Order, items and customer data are required",
      }),
    };
  }

  // Create customer record
  const customerParams = {
    TableName: TABLE_NAME,
    Item: {
      PK: `CUSTOMER#${order.customer.customerId}`,
      SK: `ORDER#${order.orderId}`,
      ...order.customer,
    },
  };

  // Create order record
  const orderParams = {
    TableName: TABLE_NAME,
    Item: {
      PK: `ORDER#${order.orderId}`,
      SK: `ORDER#${order.orderId}`,
      items: order.items,
      payment: order.payment,
      status: "PROCESSING",
      orderDate: new Date().toISOString(),
    },
  };

  // Process each item in the order
  const itemsPromises = order.items.map((item) => {
    const itemParams = {
      TableName: TABLE_NAME,
      Item: {
        PK: `ORDER#${order.orderId}`,
        SK: `ITEM#${item.itemId}`,
        ...item,
        status: "PROCESSING",
      },
    };
    return ddb.put(itemParams).promise();
  });

  // Create payment record
  const paymentParams = {
    TableName: TABLE_NAME,
    Item: {
      PK: `PAYMENT#${order.payment.paymentId}`,
      SK: `PAYMENT#${order.payment.paymentId}`,
      orderId: order.orderId,
      customer: order.customer,
      items: order.items,
      payment: order.payment,
      status: "PROCESSING",
      paymentDate: new Date().toISOString(),
    },
  };

  try {
    // Create records for the customer, order, and each item in parallel
    await Promise.all([
      ddb.put(customerParams).promise(),
      ddb.put(orderParams).promise(),
      ...itemsPromises,
      ddb.put(paymentParams).promise(),
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Order processed successfully",
        orderId: order.orderId,
        customer: order.customer,
        payment: order.payment,
        items: order.items,
      }),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing order:", errorMessage);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Failed to process order",
        error: errorMessage,
      }),
    };
  }
};
