const { expect } = require('chai')
const { parseUnits, parseEther } = require('ethers/lib/utils')
const { ethers, network } = require('hardhat')
const { provider } = ethers

const { formatEther } = ethers.utils

const sign = require('./utils/createCheque')

describe('PrimarySaleOrchestrator', function () {
  let pso
  let nft
  let deployer, holder, bidWinner

  const ONE_DAY = 60 * 60 * 24
  const ONE_HOUR = 60 * 60

  let cheque, chequeTooOld, chequeTooYoung, chequeHolder, chequeInvalidDates
  let _priceNotEnough

  let currentBlockTimestamp

  const CALLDATA = '0x00'

  async function oneDayAhead() {
    //https://ethereum.stackexchange.com/questions/86633/time-dependent-tests-with-hardhat
    await network.provider.send('evm_setNextBlockTimestamp', [currentBlockTimestamp + ONE_DAY])
    await network.provider.send('evm_mine') // this one will have 2021-07-01 12:00 AM as its timestamp, no matter what the previous block has
  }

  beforeEach(async function () {
    ;[deployer, holder, bidWinner, paymentRecipient] = await ethers.getSigners()

    currentBlockTimestamp = parseInt((await provider.getBlock(await provider.getBlockNumber())).timestamp)

    const NFT = await ethers.getContractFactory('ERC1155Mock')
    nft = await NFT.deploy()

    const PrimarySaleOrchestrator = await ethers.getContractFactory('PrimarySaleOrchestrator')
    pso = await PrimarySaleOrchestrator.deploy()

    await nft.deployed()
    await pso.deployed()

    await nft.mint(holder.address, 0, 2, CALLDATA)

    this.mock = pso

    _priceNotEnough = parseUnits('59', 'ether')

    cheque = await sign(
      deployer,
      nft.address,
      0,
      holder.address,
      parseUnits('60.0', 'ether'),
      bidWinner.address,
      paymentRecipient.address,
      currentBlockTimestamp - ONE_HOUR,
      currentBlockTimestamp + ONE_HOUR,
      pso,
    )

    chequeTooOld = await sign(
      deployer,
      nft.address,
      0,
      holder.address,
      ethers.utils.parseUnits('60', 'ether'),
      bidWinner.address,
      paymentRecipient.address,
      currentBlockTimestamp - ONE_DAY - ONE_HOUR,
      currentBlockTimestamp - ONE_DAY + ONE_HOUR,
      pso,
    )

    chequeTooYoung = await sign(
      deployer,
      nft.address,
      0,
      holder.address,
      ethers.utils.parseUnits('60', 'ether'),
      bidWinner.address,
      paymentRecipient.address,
      currentBlockTimestamp + ONE_DAY - ONE_HOUR,
      currentBlockTimestamp + ONE_DAY + ONE_HOUR,
      pso,
    )

    chequeHolder = await sign(
      holder,
      nft.address,
      0,
      holder.address,
      parseUnits('60', 'ether'),
      bidWinner.address,
      paymentRecipient.address,
      currentBlockTimestamp - ONE_HOUR,
      currentBlockTimestamp + ONE_HOUR,
      pso,
    )

    chequeInvalidDates = await sign(
      deployer,
      nft.address,
      0,
      holder.address,
      parseUnits('60', 'ether'),
      bidWinner.address,
      paymentRecipient.address,
      //These are backwar
      currentBlockTimestamp + ONE_HOUR,
      currentBlockTimestamp - ONE_HOUR,
      pso,
    )

    await pso.setSigners([deployer.address])
  })

  it('Should exist when deployed', async function () {
    await pso.deployed()
  })

  it('Should complete the auction successfully using the cheque', async function () {
    await nft.connect(holder).setApprovalForAll(pso.address, true)

    const initialBalance = await provider.getBalance(paymentRecipient.address)

    const hash = await pso.doHash(
      cheque._id,
      cheque._tokenAddress,
      cheque._tokenId,
      cheque._holderAddress,
      cheque._price,
      cheque._bidWinnerAddress,
      cheque._paymentRecipientAddress,
      cheque._startDate,
      cheque._deadline,
    )
    const recoverExpected = deployer.address
    const recoverReceived = await pso.recover(hash, cheque._signature.v, cheque._signature.r, cheque._signature.s)

    const recoverSigners = await pso.signersAll()

    const result = await call_PSO_fulfillBid(pso, bidWinner, cheque)

    const finalBalance = await provider.getBalance(paymentRecipient.address)

    expect(formatEther(finalBalance)).to.equal(formatEther(initialBalance.add(cheque._price)))
  })

  it('Should revert when claiming the same cheque twice', async function () {
    await nft.connect(holder).setApprovalForAll(pso.address, true)

    await call_PSO_fulfillBid(pso, bidWinner, cheque)

    const secondTx = call_PSO_fulfillBid(pso, bidWinner, cheque)
    await expect(secondTx).revertedWith('CHEQUEUSED')
  })

  it('Should revert when dates are backwards', async function () {
    await nft.connect(holder).setApprovalForAll(pso.address, true)

    const result = call_PSO_fulfillBid(pso, bidWinner, chequeInvalidDates)

    await expect(result).to.be.revertedWith('ERRDATEINVALID')
  })

  it('Should revert when signer is not a valid one', async function () {
    await nft.connect(holder).setApprovalForAll(pso.address, true)

    const result = call_PSO_fulfillBid(pso, bidWinner, chequeHolder)

    await expect(result).to.be.revertedWith('ERR05')
  })

  it('Should fail when setSigners is called by other than owner', async function () {
    const result = pso.connect(holder).setSigners([holder.address])
    await expect(result).to.be.revertedWith('Ownable: caller is not the owner')
  })

  it('Should fail when using too late a cheque for finishing the sale', async function () {
    await nft.connect(holder).setApprovalForAll(pso.address, true)

    const result = call_PSO_fulfillBid(pso, bidWinner, chequeTooOld)

    await expect(result).to.be.revertedWith('ERRDATELATE')
  })

  it('Should fail when using too early a cheque for finishing the sale', async function () {
    const allowanceResult = await nft.connect(holder).setApprovalForAll(pso.address, true)

    const result = call_PSO_fulfillBid(pso, bidWinner, chequeTooYoung)

    await expect(result).to.be.revertedWith('ERRDATESOON')
  })

  it('Should revert if the caller is not the bid winner', async function () {
    await nft.connect(holder).setApprovalForAll(pso.address, true)

    const result = call_PSO_fulfillBid(pso, deployer, cheque)

    await expect(result).to.be.revertedWith('ERR3')
  })

  it('Should revert when there is not enough native token payed to the SC', async function () {
    await nft.connect(holder).setApprovalForAll(pso.address, true)

    const result = call_PSO_fulfillBid(pso, deployer, cheque, {
      value: _priceNotEnough,
    })

    await expect(result).to.be.revertedWith('ERR2')
  })

  it('Should revert when there is no native token payed to the SC', async function () {
    await nft.connect(holder).setApprovalForAll(pso.address, true)

    const result = call_PSO_fulfillBid(pso, deployer, cheque, {})

    await expect(result).to.be.revertedWith('ERR2')
  })

  it('Should revert when the contract has no allowance for moving the NFT from the holder', async function () {
    const result = call_PSO_fulfillBid(pso, deployer, cheque)
    await expect(result).to.be.revertedWith('ERR1')
  })

  it('Should revert when receiving ether with data', async function () {
    const tx = {
      to: pso.address,
      value: parseEther('1'),
      data: '0x01',
    }

    const sendTransaction = deployer.sendTransaction(tx)

    await expect(sendTransaction).revertedWith('ERR01')
  })

  it('Should revert when receiving ether with no data', async function () {
    const tx = {
      to: pso.address,
      value: parseEther('1'),
    }
    const sendTransaction = deployer.sendTransaction(tx)

    await expect(sendTransaction).revertedWith('ERR01')
  })
})
async function call_PSO_fulfillBid(primarySaleOrchestrator, caller, cheque, overrides) {
  return primarySaleOrchestrator.connect(caller).fulfillBid(
    cheque._id,
    cheque._tokenAddress,
    cheque._tokenId,
    cheque._holderAddress,
    cheque._price,
    cheque._bidWinnerAddress,
    cheque._paymentRecipientAddress,
    cheque._startDate,
    cheque._deadline,
    [
      {
        r: cheque._signature.r,
        s: cheque._signature.s,
        v: cheque._signature.v,
      },
    ],
    overrides
      ? overrides
      : {
          value: cheque._price,
        },
  )
}
