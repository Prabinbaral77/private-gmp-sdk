// TODOS:
// 1. Add the aleo account derivation ie when source chain is aleo
// a. User sign the message with their aleo account
//b. use that signature to derive the account address and create the private record ie make_wallet to store that signature in the vault contract

//2. During fee sponsership add the validation ie
//Claim FLow
// a. check commitments mapping wheather the claim is already claimed or not
// commitments key => check status if the status is true then return error else proceed with the fee sponsorship
//Refund Flow
//a. check withdraw_commitment mapping whether the commitment hash is already withdrawn or not
// if the commitment hash is already withdrawn then return error else proceed with the refund ie intent_status should be TAG_INTENT_FAILED 
//withdraw flow
//a. check withdraw_commitment mapping if the mapping contains information about the commitment hash then reject withdraw else
//  proceed with the withdraw

//3. Add refund logic support in the sdk


//Make proper flow
//1. User sign the message with their sodax connected chain
//2. Derive aleo wallet keypair from signature
//3. get costumerID from provable api ie to delegate the execution to provable
//4. call claim, withdraw and refund using users customerID and apiKey with fee sponsership 


//add support for evm contract read mapping functionality in the sdk   Try to make generic 
//add support for aleo contract read mapping functionality in the sdk  
