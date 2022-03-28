const { expect } = require('chai')
const { parseUnits, parseEther } = require('ethers/lib/utils')
const { ethers, network } = require('hardhat')
const { provider } = ethers

const { formatEther } = ethers.utils

function getRandomInt(max) {
  return Math.floor(Math.random() * max)
}

async function createCheque(
  signer,
  _tokenAddress,
  _tokenId,
  _holderAddress,
  _price,
  _bidWinnerAddress,
  _paymentRecipientAddress,
  _startDate,
  _deadline,
  pso,
  id,
) {
  /*
    let msgHash2 = await soliditySha3(
      {
        type: 'address',
        value: _tokenAddress,
      },
      { type: 'uint256', value: _tokenId },
    )
    */
  const _id = id ? id : getRandomInt(100000)

  const msgHash1 = await pso.doHash(
    _id,
    _tokenAddress,
    _tokenId,
    _holderAddress,
    _price,
    _bidWinnerAddress,
    _paymentRecipientAddress,
    _startDate,
    _deadline,
  )

  //console.log({ msgHash1 })

  // Sign the binary data
  let signatureFull = await signer.signMessage(ethers.utils.arrayify(msgHash1))

  const ethersutilsverifyMessage = ethers.utils.verifyMessage(ethers.utils.arrayify(msgHash1), signatureFull)

  // For Solidity, we need the expanded-format of a signature
  let signature = ethers.utils.splitSignature(signatureFull)
  const primarySaleOrchestratorrecover = await pso.recover(msgHash1, signature.v, signature.r, signature.s)

  return {
    _id,
    _tokenAddress,
    _tokenId,
    _holderAddress,
    _price,
    _bidWinnerAddress,
    _paymentRecipientAddress,
    _startDate,
    _deadline,
    _signature: signature,
  }
}

module.exports = createCheque
