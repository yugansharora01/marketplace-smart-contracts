const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const MARKETPLACE_FEES = 2;

module.exports = async ({
  getNamedAccounts,
  deployments,
  getChainId,
  getUnnamedAccounts,
}) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const args = [MARKETPLACE_FEES];
  // the following will only deploy "GenericMetaTxProcessor" if the contract was never deployed or if the code changed since last deployment
  const marketplace = await deploy("NftMarketplace", {
    from: deployer,
    gasLimit: 4000000,
    args: args,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    await verify(marketplace.address, args);
  }

  log("----------------------------------------------------------------");
};

module.exports.tags = ["all", "nftmarketplace"];
