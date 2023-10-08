const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const NFT_NAME = "Nexus";
const NFT_SYMBOL = "Nex";

module.exports = async ({
  getNamedAccounts,
  deployments,
  getChainId,
  getUnnamedAccounts,
}) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const args = [NFT_NAME, NFT_SYMBOL];
  const nft = await deploy("NFT", {
    from: deployer,
    gasLimit: 4000000,
    log: true,
    args: args,
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    await verify(nft.address, args);
  }

  log("----------------------------------------------------------------");
};

module.exports.tags = ["all", "nft"];
