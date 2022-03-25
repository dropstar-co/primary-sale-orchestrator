# Purpose

DropStar carries out an off chain aution for selling digital music & art to avoid all users paying gas to submit a bid. Instead, only the winner submits a transaction to pay and claim the piece. If the winner fails to submit the transaction in 24h, loses the piece and the next one in the list can claim the piece.

This is accomplished issuing cheques when the auction is over that the bid winner submits to the blockchain. This cheque is limited in time and only the right account can claim it.

When the winner submits the transaction successfully, the ERC1155 is sent and the native token is routed to paymentAddress, which is managed with 0xSplits to distribute the funds to all contributors of the piece.

# Testing and usage

```shell
npx hardhat compile
npx hardhat clean
npx hardhat test
```
