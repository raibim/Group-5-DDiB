import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    ...(process.env.RPC_URL && process.env.PRIVATE_KEY
      ? {
          testnet: {
            url: process.env.RPC_URL,
            accounts: [process.env.PRIVATE_KEY],
          },
        }
      : {}),
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
  },
};

export default config;
