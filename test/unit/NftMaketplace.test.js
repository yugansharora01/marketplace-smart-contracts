const { assert, expect } = require("chai");
const { network, ethers, deployments } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("NftMarketplace unit tests", function () {
      let deployer,
        user,
        nftMarketplaceContractAddress,
        nftMarketplaceContract,
        nftContractAddress,
        nftContract,
        nftMarketplace,
        nft,
        tokenId;
      const PRICE = ethers.parseEther("0.1");
      const ZERO_PRICE = ethers.parseEther("0");
      const TOKEN_URI = "token_uri";

      beforeEach(async () => {
        const accounts = await ethers.getSigners();
        deployer = accounts[0];
        user = accounts[1];
        await deployments.fixture(["all"]);
        const deployedMarketplaceContract = await deployments.get(
          "NftMarketplace"
        );
        const deployedNFTContract = await deployments.get("NFT");
        nftMarketplaceContractAddress = deployedMarketplaceContract.address;
        nftContractAddress = deployedNFTContract.address;
        nftMarketplaceContract = await ethers.getContractAt(
          "NftMarketplace",
          nftMarketplaceContractAddress
        );
        nftMarketplace = nftMarketplaceContract.connect(deployer);
        nftContract = await ethers.getContractAt("NFT", nftContractAddress);
        nft = nftContract.connect(deployer);
        const transactionResponse = await nft.safeMint(
          deployer.address,
          TOKEN_URI
        );
        tokenId = transactionResponse.value;
        await nft.approve(nftMarketplaceContractAddress, tokenId);
      });

      describe("create Listing", function () {
        it("Fails if price is low", async () => {
          await expect(
            nftMarketplace.createListing(
              nftContractAddress,
              tokenId,
              ZERO_PRICE
            )
          ).to.be.revertedWithCustomError(
            nftMarketplace,
            "NftMarketplace__PriceMustBeAboveZero"
          );
        });

        it("emits an event after listing an item", async () => {
          await expect(
            nftMarketplace.createListing(nftContractAddress, tokenId, PRICE)
          ).to.emit(nftMarketplace, "ListingCreated");
        });

        it("exclusively allows owners to list", async () => {
          nftMarketplace = nftMarketplace.connect(user);
          await nft.approve(user.address, tokenId);
          await expect(
            nftMarketplace.createListing(nftContractAddress, tokenId, PRICE)
          ).to.be.revertedWithCustomError(
            nftMarketplace,
            "NftMarketplace__NotNftOwner"
          );
        });

        it("Lists only if marketplace have approval", async () => {
          await nft.approve(
            "0x0000000000000000000000000000000000000000",
            tokenId
          );
          await expect(
            nftMarketplace.createListing(nftContractAddress, tokenId, PRICE)
          ).to.be.revertedWithCustomError(
            nftMarketplace,
            "NftMarketplace__NotApprovedForMarketplace"
          );
        });

        it("Updates listing with seller and price", async () => {
          await nftMarketplace.createListing(
            nftContractAddress,
            tokenId,
            PRICE
          );
          const listing = await nftMarketplace.getListing(
            nftContractAddress,
            tokenId
          );
          assert(listing.listPrice == PRICE.toString());
          assert(listing.seller == deployer.address);
        });

        it("lists only the items that haven't been listed", async () => {
          nftMarketplace = nftMarketplace.connect(deployer);
          await nftMarketplace.createListing(
            nftContractAddress,
            tokenId,
            PRICE
          );
          await expect(
            nftMarketplace.createListing(nftContractAddress, tokenId, PRICE)
          ).to.be.revertedWithCustomError(
            nftMarketplace,
            "NftMarketplace__AlreadyListed"
          );
        });
      });

      describe("Buy Item", function () {
        it("Cannot buy not listed item", async () => {
          await expect(
            nftMarketplace.buyListing(nftContractAddress, tokenId)
          ).to.be.revertedWithCustomError(
            nftMarketplace,
            "NftMarketplace__NotListed"
          );
        });

        it("Cannot buy if value is lower than price", async () => {
          await nftMarketplace.createListing(
            nftContractAddress,
            tokenId,
            PRICE
          );
          await expect(
            nftMarketplace.buyListing(nftContractAddress, tokenId, {
              value: ZERO_PRICE,
            })
          ).to.be.revertedWithCustomError(
            nftMarketplace,
            "NftMarketplace__PriceNotMet"
          );
        });
      });
    });
