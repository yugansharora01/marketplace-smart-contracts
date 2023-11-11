const {
  frontEndContractsFile,
  frontEndAbiLocation,
} = require("../helper-hardhat-config");
require("dotenv").config();
const fs = require("fs");
const { network, deployments, ethers } = require("hardhat");

module.exports = async () => {
  if (process.env.UPDATE_FRONT_END) {
    console.log("Writing to front end...");
    await updateContractAddresses();
    await updateAbi();
    console.log("Front end written!");
  }
};

async function updateAbi() {
  const nftMarketplace = await deployments.get("NftMarketplace");
  //console.log(nftMarketplace.abi);
  //const file = JSON.parse(nftMarketplace.toString());
  //.log(file.abi);
  //   JSON.parse(
  //     fs.readFileSync("deployments/localhost/NftMarketplace.json", "utf8")
  //   )

  fs.writeFileSync(
    `${frontEndAbiLocation}NftMarketplace.json`,
    JSON.stringify(nftMarketplace.abi)
  );

  const Nft = await deployments.get("NFT");
  fs.writeFileSync(`${frontEndAbiLocation}Nft.json`, JSON.stringify(Nft.abi));
}

async function updateContractAddresses() {
  const chainId = network.config.chainId.toString();
  const nftMarketplace = await deployments.get("NftMarketplace");
  const Nft = await deployments.get("NFT");
  //const nftMarketplace = await ethers.getContractAt("NftMarketplace")
  const contractAddresses = JSON.parse(
    fs.readFileSync(frontEndContractsFile, "utf8")
  );
  if (chainId in contractAddresses) {
    if (
      !contractAddresses[chainId]["NftMarketplace"].includes(
        nftMarketplace.address
      )
    ) {
      contractAddresses[chainId]["NftMarketplace"].push(nftMarketplace.address);
    }
    if (!contractAddresses[chainId]["Nft"].includes(Nft.address)) {
      contractAddresses[chainId]["Nft"].push(Nft.address);
    }
  } else {
    contractAddresses[chainId] = { NftMarketplace: [nftMarketplace.address] };
  }
  fs.writeFileSync(frontEndContractsFile, JSON.stringify(contractAddresses));
}
module.exports.tags = ["all", "frontend"];
