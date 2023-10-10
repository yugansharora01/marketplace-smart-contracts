// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error NftMarketplace__PriceMustBeAboveZero();
error NftMarketplace__NotApprovedForMarketplace();
error NftMarketplace__PriceNotMet();
error NftMarketplace__AlreadyListed();
error NftMarketplace__NotListed();
error NftMarketplace__NotNftOwner();
error NftMarketplace__NotOwner();
error NftMarketplace__NoProceeds();
error NftMarketplace__TransferFailed();
error NftMarketplace__NotMarketplaceOwner();

contract NftMarketplace is ERC721Holder, ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 listPrice;
    }

    mapping(address => mapping(uint256 => Listing)) private s_listings;
    mapping(address => uint256) s_proceeds;

    uint256 private s_marketplaceFees;
    address private immutable OWNER;

    event ListingCreated(
        address indexed nftAddress,
        uint256 indexed tokenId,
        address seller,
        uint256 listPrice
    );

    event ListingUpdated(
        address indexed nftAddress,
        uint256 indexed tokenId,
        address seller,
        uint256 listPrice
    );

    event ListingBought(
        address indexed nftAddress,
        uint256 indexed tokenId,
        address buyer,
        uint256 price
    );

    event ListingCancelled(
        address indexed nftAddress,
        uint256 indexed tokenId,
        address indexed seller
    );

    modifier shouldNotBeListed(address nftAddress, uint256 tokenId) {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.listPrice > 0) {
            revert NftMarketplace__AlreadyListed();
        }
        _;
    }

    modifier isListed(address nftAddress, uint256 tokenId) {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.listPrice <= 0) {
            revert NftMarketplace__NotListed();
        }
        _;
    }

    modifier isNftOwner(address nftAddress, uint256 tokenId) {
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);
        if (owner != msg.sender) {
            revert NftMarketplace__NotNftOwner();
        }
        _;
    }

    modifier isMarketplaceOwner() {
        if (OWNER != msg.sender) {
            revert NftMarketplace__NotMarketplaceOwner();
        }
        _;
    }

    constructor(uint256 fees) {
        OWNER = msg.sender;
        s_marketplaceFees = fees;
    }

    function createListing(
        address nftAddress,
        uint256 tokenId,
        uint256 price
    )
        external
        shouldNotBeListed(nftAddress, tokenId)
        isNftOwner(nftAddress, tokenId)
    {
        if (price <= 0) {
            revert NftMarketplace__PriceMustBeAboveZero();
        }

        if (IERC721(nftAddress).getApproved(tokenId) != address(this)) {
            revert NftMarketplace__NotApprovedForMarketplace();
        }

        s_listings[nftAddress][tokenId] = Listing({
            seller: msg.sender,
            listPrice: price
        });

        emit ListingCreated(nftAddress, tokenId, msg.sender, price);
    }

    function buyListing(
        address nftAddress,
        uint256 tokenId
    ) external payable isListed(nftAddress, tokenId) nonReentrant {
        Listing memory listing = s_listings[nftAddress][tokenId];
        uint256 price = listing.listPrice;
        if (msg.value != price) {
            revert NftMarketplace__PriceNotMet();
        }

        uint256 feesAmount = (price * s_marketplaceFees) / 100;
        //uint256 valueEarned = (price * (100 - s_marketplaceFees)) / 100;
        s_proceeds[listing.seller] += (price - feesAmount);

        (bool success, ) = payable(OWNER).call{value: feesAmount}("");
        if (!success) {
            revert NftMarketplace__TransferFailed();
        }

        s_listings[nftAddress][tokenId].listPrice = 0; // Remove the listing

        IERC721(nftAddress).safeTransferFrom(
            listing.seller,
            msg.sender,
            tokenId
        );

        emit ListingBought(nftAddress, tokenId, msg.sender, price);
    }

    function cancelListing(
        address nftAddress,
        uint256 tokenId
    )
        external
        isListed(nftAddress, tokenId)
        isNftOwner(nftAddress, tokenId)
        nonReentrant
    {
        delete s_listings[nftAddress][tokenId];
        emit ListingCancelled(nftAddress, tokenId, msg.sender);
    }

    function updateListing(
        address nftAddress,
        uint256 tokenId,
        uint256 newPrice
    ) external isListed(nftAddress, tokenId) isNftOwner(nftAddress, tokenId) {
        if (newPrice <= 0) {
            revert NftMarketplace__PriceMustBeAboveZero();
        }
        s_listings[nftAddress][tokenId].listPrice = newPrice;
        emit ListingUpdated(nftAddress, tokenId, msg.sender, newPrice);
    }

    function withdrawProceeds() external {
        uint256 proceeds = s_proceeds[msg.sender];
        if (proceeds <= 0) {
            revert NftMarketplace__NoProceeds();
        }
        s_proceeds[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: proceeds}("");
        if (!success) {
            revert NftMarketplace__TransferFailed();
        }
    }

    function setMarketplaceFees(uint256 newFees) external isMarketplaceOwner {
        s_marketplaceFees = newFees;
    }

    /////////////////////
    // Getter Functions //
    /////////////////////

    function getListing(
        address nftAddress,
        uint256 tokenId
    ) external view returns (Listing memory) {
        return s_listings[nftAddress][tokenId];
    }

    function getProceeds(address seller) external view returns (uint256) {
        return s_proceeds[seller];
    }

    function getMarketplaceFees() external view returns (uint256) {
        return s_marketplaceFees;
    }

    function getOwner() external view returns (address) {
        return OWNER;
    }
}
