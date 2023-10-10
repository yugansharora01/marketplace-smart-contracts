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

      describe("constructor", function () {
        it("initializes owner and fees", async () => {
          const owner = await nftMarketplace.getOwner();
          assert(owner.toString() == deployer.address);
          const expectedFees = 2;
          const fetchedFees = await nftMarketplace.getMarketplaceFees();
          assert(expectedFees.toString() == fetchedFees.toString());
        });
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

        it("should emit Listing Bought event", async () => {
          await nftMarketplace.createListing(
            nftContractAddress,
            tokenId,
            PRICE
          );
          await expect(
            nftMarketplace.buyListing(nftContractAddress, tokenId, {
              value: PRICE,
            })
          ).to.emit(nftMarketplace, "ListingBought");
        });

        it("should add proceeds for the seller", async () => {
          await nftMarketplace.createListing(
            nftContractAddress,
            tokenId,
            PRICE
          );
          await nftMarketplace.buyListing(nftContractAddress, tokenId, {
            value: PRICE,
          });
          const proceed = await nftMarketplace.getProceeds(deployer.address);
          const marketplaceFees = await nftMarketplace.getMarketplaceFees();
          const expectedFees = parseInt(PRICE * marketplaceFees) / 100;
          const expectedProceed = parseInt(PRICE) - expectedFees;
          assert(expectedProceed.toString() == proceed.toString());
        });
      });

      describe("Cancel Listing", function () {
        it("reverts if NFT is not listed", async () => {
          await expect(
            nftMarketplace.cancelListing(nftContractAddress, tokenId)
          ).to.be.revertedWithCustomError(
            nftMarketplace,
            "NftMarketplace__NotListed"
          );
        });

        it("reverts if sender is not nft owner", async () => {
          await nftMarketplace.createListing(
            nftContractAddress,
            tokenId,
            PRICE
          );
          const marketplace = nftMarketplace.connect(user);
          await expect(
            marketplace.cancelListing(nftContractAddress, tokenId)
          ).to.be.revertedWithCustomError(
            marketplace,
            "NftMarketplace__NotNftOwner"
          );
        });

        it("deletes the listing and emits ListingCancelled event", async () => {
          await nftMarketplace.createListing(
            nftContractAddress,
            tokenId,
            PRICE
          );
          await expect(
            nftMarketplace.cancelListing(nftContractAddress, tokenId)
          ).to.emit(nftMarketplace, "ListingCancelled");

          const listing = await nftMarketplace.getListing(
            nftContractAddress,
            tokenId
          );
          assert(listing.listPrice == 0);
        });
      });

      describe("Update Listing", function () {
        it("reverts if NFT is not listed", async () => {
          const NEW_PRICE = ethers.parseEther("1");
          await expect(
            nftMarketplace.updateListing(nftContractAddress, tokenId, NEW_PRICE)
          ).to.be.revertedWithCustomError(
            nftMarketplace,
            "NftMarketplace__NotListed"
          );
        });

        it("reverts if sender is not nft owner", async () => {
          const NEW_PRICE = ethers.parseEther("1");
          await nftMarketplace.createListing(
            nftContractAddress,
            tokenId,
            PRICE
          );
          const marketplace = nftMarketplace.connect(user);
          await expect(
            marketplace.updateListing(nftContractAddress, tokenId, NEW_PRICE)
          ).to.be.revertedWithCustomError(
            marketplace,
            "NftMarketplace__NotNftOwner"
          );
        });

        it("reverts if new Price is zero", async () => {
          await nftMarketplace.createListing(
            nftContractAddress,
            tokenId,
            PRICE
          );
          await expect(
            nftMarketplace.updateListing(
              nftContractAddress,
              tokenId,
              ZERO_PRICE
            )
          ).to.be.revertedWithCustomError(
            nftMarketplace,
            "NftMarketplace__PriceMustBeAboveZero"
          );
        });

        it("updates listing and emits an event", async () => {
          const NEW_PRICE = ethers.parseEther("1");
          await nftMarketplace.createListing(
            nftContractAddress,
            tokenId,
            PRICE
          );
          await expect(
            nftMarketplace.updateListing(nftContractAddress, tokenId, NEW_PRICE)
          ).to.emit(nftMarketplace, "ListingUpdated");

          const listing = await nftMarketplace.getListing(
            nftContractAddress,
            tokenId
          );
          assert(listing.listPrice.toString() == NEW_PRICE.toString());
        });
      });

      describe("Withdraw Proceeding", async () => {
        it("reverts if there are no proceeds", async () => {
          await expect(
            nftMarketplace.withdrawProceeds()
          ).to.be.revertedWithCustomError(
            nftMarketplace,
            "NftMarketplace__NoProceeds"
          );
        });
        it("update proceeds and withdraw is completed", async () => {
          await nftMarketplace.createListing(
            nftContractAddress,
            tokenId,
            PRICE
          );
          await nftMarketplace.buyListing(nftContractAddress, tokenId, {
            value: PRICE,
          });
          await nftMarketplace.withdrawProceeds();
          const proceed = await nftMarketplace.getProceeds(deployer.address);
          assert(proceed.toString() == 0);
        });
      });

      describe("Set Marketplace Fees", function () {
        it("reverts if sender is not marketplace owner", async () => {
          const marketplace = nftMarketplace.connect(user);
          const newFees = 3;
          await expect(
            marketplace.setMarketplaceFees(newFees)
          ).to.be.revertedWithCustomError(
            marketplace,
            "NftMarketplace__NotMarketplaceOwner"
          );
        });

        it("updates marketplace fees", async () => {
          const newFees = 3;
          await nftMarketplace.setMarketplaceFees(newFees);
          const fetchedFees = await nftMarketplace.getMarketplaceFees();
          assert(newFees.toString() == fetchedFees.toString());
        });
      });
    });
