const networkconfig = {
  11155111: {
    name: "sepolia",
  },
  137: {
    name: "polygon",
  },
};

const developmentChains = ["hardhat", "localhost"];
const frontEndContractsFile = "../marketplace/constants/networkMapping.json";
const frontEndAbiLocation = "../marketplace/constants/";

module.exports = {
  networkconfig,
  developmentChains,
  frontEndContractsFile,
  frontEndAbiLocation,
};
