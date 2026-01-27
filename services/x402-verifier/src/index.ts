import './env';

import express, { Request, Response } from "express";
import cors from "cors";
import { settlePayment } from "thirdweb/x402";
import { thirdwebFacilitator, getChain } from "./facilitator";

const app = express();
// Default to 3002 to match X402_SERVICE_URL in env.example
// Can be overridden with PORT environment variable
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());


app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "healthy", service: "x402-verifier" });
});

app.post("/settle-payment", async (req: Request, res: Response) => {
  try {
    const { resourceUrl, method, paymentData, payTo, network, price, routeConfig } = req.body;
    const merchantWallet = payTo || process.env.MERCHANT_WALLET_ADDRESS;

    if (!resourceUrl || !method || !network || !price || !merchantWallet) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const chain = getChain(network);
    // Safely parse paymentData - it might be JSON string or already an object
    let parsedPaymentData = null;
    if (paymentData) {
      if (typeof paymentData === "string") {
        try {
          // Try to parse as JSON, but handle if it's not valid JSON (e.g., JWT token)
          parsedPaymentData = JSON.parse(paymentData);
        } catch (e) {
          // If parsing fails, it might be a JWT token or other string format
          // Pass it through as-is (settlePayment can handle it)
          parsedPaymentData = paymentData;
        }
      } else {
        parsedPaymentData = paymentData;
      }
    }

    // Thirdweb x402 supports:
    // - string price: "$0.10"
    // - object price: { amount: "100000", asset: { address: "0x...", decimals?: 6 } }
    const parsedPrice: any = price;

    let result;
    try {
      result = await settlePayment({
        resourceUrl,
        method,
        paymentData: parsedPaymentData,
        payTo: merchantWallet as `0x${string}`,
        network: chain,
        price: parsedPrice,
        facilitator: thirdwebFacilitator,
        routeConfig: routeConfig || {
          description: "HyperAgent API endpoint",
          mimeType: "application/json",
          maxTimeoutSeconds: 300,
        },
      });
    } catch (settleError: any) {
      // Handle errors from settlePayment (e.g., network errors, 502 from Thirdweb service)
      let errorMessage = "Settlement error";
      let statusCode = 500;
      
      if (settleError && typeof settleError === 'object') {
        // Check if it's a network/HTTP error
        if (settleError.status || settleError.statusCode) {
          statusCode = settleError.status || settleError.statusCode || 500;
          errorMessage = settleError.message || `Settlement service returned ${statusCode}`;
        } else if (settleError.message) {
          errorMessage = String(settleError.message);
          // Check if error message indicates 502
          if (errorMessage.includes('502') || errorMessage.includes('Bad Gateway')) {
            statusCode = 502;
            errorMessage = "Failed to settle payment: 502 Bad Gateway. The settlement service is temporarily unavailable.";
          }
        } else if (settleError.toString) {
          errorMessage = String(settleError.toString());
        }
      } else if (settleError) {
        errorMessage = String(settleError);
      }
      
      // Don't expose JWT tokens in error messages
      if (errorMessage.includes('eyJ') && errorMessage.length > 100) {
        errorMessage = "Payment verification error - invalid response format";
      }
      
      console.error("x402 settlement error from settlePayment:", errorMessage);
      
      // Return appropriate error response
      if (statusCode === 502) {
        return res.status(502).json({
          status: 502,
          verified: false,
          error: "Settlement error",
          errorMessage: errorMessage,
        });
      }
      
      return res.status(statusCode).json({
        status: statusCode,
        verified: false,
        error: "Settlement error",
        errorMessage: errorMessage,
      });
    }

    const responseHeaders = (result as any).responseHeaders || {};
    // Always forward x402 headers (PAYMENT-REQUIRED / PAYMENT-RESPONSE, etc.)
    Object.entries(responseHeaders).forEach(([key, value]) => {
      res.setHeader(key, value as string);
    });

    if (result.status === 200) {
      // Payment verified successfully
      res.json({
        status: 200,
        verified: true,
        message: "Payment verified and settled",
        responseHeaders,
      });
    } else {
      // For non-200 responses (including 402), return the responseBody directly
      const responseBody = (result as any).responseBody;
      const statusCode = result.status || 500;

      if (statusCode === 402) {
        res.status(402).json({
          status: 402,
          verified: false,
          responseBody,
          responseHeaders,
        });
      } else {
        const errorMsg = typeof responseBody === "string"
          ? responseBody
          : (responseBody?.error || responseBody?.errorMessage || "Payment verification failed");

        res.status(statusCode).json({
          status: statusCode,
          verified: false,
          error: statusCode === 502 ? "Settlement error" : errorMsg,
          errorMessage: statusCode === 502
            ? "Failed to settle payment: 502 Bad Gateway. The settlement service is temporarily unavailable."
            : errorMsg,
          responseHeaders,
        });
      }
    }
  } catch (error: any) {
    // Safely extract error message without trying to parse JWT tokens
    let errorMessage = "Settlement error";
    let statusCode = 500;
    
    if (error && typeof error === 'object') {
      // Check if it's an HTTP error with status code
      if (error.status || error.statusCode) {
        statusCode = error.status || error.statusCode || 500;
        errorMessage = error.message || `Settlement service returned ${statusCode}`;
      } else if (error.message) {
        errorMessage = String(error.message);
        // Check if error message indicates 502
        if (errorMessage.includes('502') || errorMessage.includes('Bad Gateway')) {
          statusCode = 502;
          errorMessage = "Failed to settle payment: 502 Bad Gateway. The settlement service is temporarily unavailable.";
        }
      } else if (error.toString) {
        errorMessage = String(error.toString());
      }
    } else if (error) {
      errorMessage = String(error);
    }
    
    // Don't expose JWT tokens in error messages
    if (errorMessage.includes('eyJ') && errorMessage.length > 100) {
      errorMessage = "Payment verification error - invalid response format";
    }
    
    console.error("x402 settlement error:", errorMessage);
    res.status(statusCode).json({
      status: statusCode,
      verified: false,
      error: statusCode === 502 ? "Settlement error" : errorMessage,
      errorMessage: statusCode === 502 
        ? "Failed to settle payment: 502 Bad Gateway. The settlement service is temporarily unavailable."
        : errorMessage,
    });
  }
});

app.listen(PORT, () => {
  console.log(`x402 Verification Service running on port ${PORT}`);
});
