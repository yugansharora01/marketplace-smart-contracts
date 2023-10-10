// We are going to skip a bit on these tests...

const { assert } = require("chai");
const { network, deployments, ethers } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

//writing the test code from here..

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Basic NFT Unit Tests", function () {
      let deployer, nftContractAddress, nftContract, nft, tokenId;
      const TOKEN_URI = "token_uri";

      beforeEach(async () => {
        accounts = await ethers.getSigners();
        deployer = accounts[0];
        await deployments.fixture(["NFT"]);
        const deployedNFTContract = await deployments.get("NFT");
        nftContractAddress = deployedNFTContract.address;
        nftContract = await ethers.getContractAt("NFT", nftContractAddress);
        nft = nftContract.connect(deployer);
      });

      describe("Constructor", function () {
        it("Initializes the NFT Correctly.", async () => {
          const name = await nft.name();
          const symbol = await nft.symbol();
          assert.equal(name, "Nexus");
          assert.equal(symbol, "Nex");
        });
      });

      describe("Mint NFT", function () {
        beforeEach(async () => {
          const txResponse = await nft.safeMint(deployer.address, TOKEN_URI);
          tokenId = txResponse.value;
          await txResponse.wait(1);
        });

        it("Allows users to mint an NFT, and updates appropriately", async function () {
          assert.equal(tokenId.toString(), "0");
          assert.equal(await nft.tokenURI(tokenId), TOKEN_URI);
        });

        it("Show the correct balance and owner of an NFT", async function () {
          const deployerAddress = deployer.address;
          const deployerBalance = await nft.balanceOf(deployerAddress);
          const owner = await nft.ownerOf("0");

          assert.equal(deployerBalance.toString(), "1");
          assert.equal(owner, deployerAddress);
        });
      });

      describe("supportsInterface", function () {
        beforeEach(async () => {
          const txResponse = await nft.safeMint(deployer.address, TOKEN_URI);
          tokenId = txResponse.value;
          await txResponse.wait(1);
        });
        it("checks if support interface is working", async () => {
          assert.equal(await nft.supportsInterface("0x80ac58cd"), true);
        });
      });
    });
