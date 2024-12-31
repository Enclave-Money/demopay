import logo from './logo.svg';
import './App.css';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

import { Enclave, SignMode } from 'enclavemoney';
const API_KEY = 'INSERT_API_KEY';
const enclave = new Enclave(API_KEY);

function App() {
  const [walletAddress, setWalletAddress] = useState('');
  const [smartAccount, setSmartAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transactionHash, setTransactionHash] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  const fetchBalance = async () => {
    if (smartAccount) {
      try {
        const balanceData = await enclave.getSmartBalance(smartAccount);
        setBalance(balanceData);
      } catch (error) {
        console.log('Error fetching balance:', error);
      }
    }
  };

  useEffect(() => {
    if (smartAccount) {
      fetchBalance();
      
      const interval = setInterval(fetchBalance, 10000);
      
      return () => clearInterval(interval);
    }
  }, [smartAccount]);

  async function requestAccount() {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
        setWalletAddress(accounts[0]);
        
        // Create smart account after wallet connection
        const account = await enclave.createSmartAccount(accounts[0]);

        console.log(account);

        setSmartAccount(account.wallet.scw_address);
        console.log('Smart Account created:', account.wallet.scw_address);
        
      } catch (error) {
        console.log('Error:', error);
      }
    } else {
      alert('MetaMask not detected. Please install MetaMask.');
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => alert('Address copied to clipboard!'))
      .catch((err) => console.error('Failed to copy:', err));
  };

  const handleTransfer = async () => {
    if (!smartAccount || !transferAmount || !recipientAddress) {
      alert('Please fill in all fields');
      return;
    }

    setIsTransferring(true);
    
    try {
      const amount = ethers.parseUnits(transferAmount, 6); // Convert to USDC decimals
      const usdcContractAddress = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'; // USDC on Optimism

      // Create transfer data
      const erc20Interface = new ethers.Interface([
        'function transfer(address to, uint256 amount)'
      ]);
      const encodedData = erc20Interface.encodeFunctionData('transfer', [recipientAddress, amount]);

      const transactionDetails = [{
        encodedData,
        targetContractAddress: usdcContractAddress,
        value: 0
      }];

      const orderData = {
        amount: amount.toString(),
        type: 'AMOUNT_OUT'
      };

      // Build transaction
      const builtTxn = await enclave.buildTransaction(
        transactionDetails,
        10, // Optimism network
        smartAccount,
        orderData,
        undefined,
        SignMode.ECDSA
      );

      // Request signature from wallet
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [builtTxn.messageToSign, walletAddress],
      });

      // Submit transaction
      const response = await enclave.submitTransaction(
        signature,
        builtTxn.userOp,
        10,
        smartAccount,
        SignMode.ECDSA
      );

      // Store the transaction hash
      setTransactionHash(response.txHash);
      console.log('Transfer successful:', response);
      alert('Transfer initiated successfully!');
    } catch (error) {
      console.error('Transfer failed:', error);
      alert('Transfer failed. See console for details.');
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <button onClick={requestAccount}>
          {walletAddress ? `Connected: ${walletAddress.substring(0, 6)}...${walletAddress.substring(38)}` : "Connect Wallet"}
        </button>

        {walletAddress && (
          <div style={{ marginTop: '20px', textAlign: 'left' }}>
            <p>EOA Address: {walletAddress}</p>
            {smartAccount && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <p>Smart Account: {smartAccount}</p>
                  <button 
                    onClick={() => copyToClipboard(smartAccount)}
                    style={{ padding: '5px 10px', fontSize: '14px' }}
                  >
                    Copy
                  </button>
                </div>
                {balance && (
                  <p>Balance: {ethers.formatUnits(balance.netBalance, 6)} USDC</p>
                )}
              </>
            )}
          </div>
        )}

        {smartAccount && (
          <div style={{ marginTop: '20px', width: '100%', maxWidth: '500px' }}>
            <h3>Transfer USDC</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                placeholder="Recipient Address"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                style={{ padding: '8px', width: '100%' }}
              />
              <input
                type="number"
                placeholder="Amount in USDC"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                style={{ padding: '8px', width: '100%' }}
              />
              <button 
                onClick={handleTransfer}
                disabled={isTransferring}
                style={{ 
                  padding: '10px', 
                  cursor: isTransferring ? 'not-allowed' : 'pointer',
                  opacity: isTransferring ? 0.7 : 1
                }}
              >
                {isTransferring ? 'Processing...' : 'Transfer USDC'}
              </button>
            </div>
            
            {transactionHash && (
              <div style={{ marginTop: '10px' }}>
                <p>
                  Transaction: {' '}
                  <a 
                    href={`https://optimistic.etherscan.io/tx/${transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#61dafb' }}
                  >
                    View on Explorer
                  </a>
                </p>
              </div>
            )}
          </div>
        )}
      </header>
    </div>
  );
}

export default App;
