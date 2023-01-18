from pydoc import cli
import sys
sys.path.insert(0,'.')

from algobpy.parse import parse_params
from pyteal import *

def vesting_approval():

    basic_checks = And(
        Txn.rekey_to() == Global.zero_address(),
        Txn.close_remainder_to() == Global.zero_address(),
        Txn.asset_close_to() == Global.zero_address()
    )

    assetID = Btoi(Txn.application_args[0])
    AmountTotalAdvisors = Btoi(Txn.application_args[1])
    AmountTotalPrivateInvestors = Btoi(Txn.application_args[2])
    AmountTotalCompanyReserve = Btoi(Txn.application_args[3])
    AmountTotalTeam = Btoi(Txn.application_args[4])
    handle_creation = Seq([
        Assert(basic_checks),
        App.globalPut(Bytes("vacoinid"), assetID),
        App.globalPut(Bytes("advisors"), Txn.accounts[1]),
        App.globalPut(Bytes("private_investor"), Txn.accounts[2]),
        App.globalPut(Bytes("company_reserve"), Txn.accounts[3]),
        App.globalPut(Bytes("team"), Txn.accounts[4]),

        App.globalPut(Bytes("AmountTotalAdvisors"), AmountTotalAdvisors),
        App.globalPut(Bytes("AmountTotalPrivateInvestors"), AmountTotalPrivateInvestors),
        App.globalPut(Bytes("AmountTotalCompanyReserve"), AmountTotalCompanyReserve),
        App.globalPut(Bytes("AmountTotalTeam"), AmountTotalTeam),


        App.globalPut(Bytes("withdow_Advisors"),Int(0)), #intialValue
        App.globalPut(Bytes("withdow_PrivateInvestors"),Int(0)),
        App.globalPut(Bytes("withdow_Team"),Int(0)),
        App.globalPut(Bytes("withdow_CompanyReserve"),Int(0)),

        Return(Int(1))
    ])

    initTime = Seq(
        App.globalPut(Bytes("initialTime"), Btoi(Txn.application_args[1])),
        Return(Int(1))
    )

    # opting in to receive the asset
    optin=Seq([
        Assert(basic_checks),
        Assert(App.globalGet(Bytes("optInStatus")) == Int(0)), # if this variable doesn't exist, the contract hasn't opted in before 
        Assert(Txn.assets[0] == App.globalGet(Bytes("vacoinid"))),
        Assert(Txn.sender() == Global.creator_address()),
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
        TxnField.type_enum: TxnType.AssetTransfer,
        TxnField.asset_receiver: Global.current_application_address(),
        TxnField.asset_amount: Int(0),
        TxnField.xfer_asset: Txn.assets[0], # Must be in the assets array sent as part of the application call
        }),
        InnerTxnBuilder.Submit(),
        App.globalPut(Bytes("optInStatus"), Int(1)), #this variable is created and initialized after optin
        Return(Int(1))
    ])


    year = Int(31556952) # 1 year in second
    month = Int(2629800) # 1 month in second 
    initialTime = App.globalGet(Bytes("initialTime"))
    amount = Btoi(Gtxn[1].application_args[1])
    

    @Subroutine(TealType.none)
    def signTransaction(withrowed,withdrawable):
        return Seq([ 
            Assert(App.globalGet(Bytes("vacoinid")) == Gtxn[1].assets[0]),
            Assert(Global.group_size() == Int(2)),
            Assert(Gtxn[0].type_enum() == TxnType.Payment),
            Assert(Gtxn[1].type_enum() == TxnType.ApplicationCall),
            Assert(amount <= withdrawable),
            Assert(amount > Int(0)),
            InnerTxnBuilder.Begin(),
            InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetTransfer,
            TxnField.asset_receiver: Gtxn[1].sender(),
            TxnField.asset_amount: amount,
            TxnField.xfer_asset: Gtxn[1].assets[0], # Must be in the assets array sent as part of the application call
            }),
            InnerTxnBuilder.Submit(),
            App.globalPut(withrowed,App.globalGet(withrowed)+amount),
            ])

    @Subroutine(TealType.none)
    def functionToWithdraw(withrowed,percentage,currentMonth):
       return Seq([
            If(currentMonth <= Int(12)).Then(
                Reject()
            ).ElseIf(currentMonth > Int(24)).Then(
                signTransaction(withrowed,App.globalGet(percentage)-App.globalGet(withrowed))
            ).Else(
                signTransaction(withrowed,(App.globalGet(percentage) * (currentMonth-Int(1)) / Int(24))-App.globalGet(withrowed))
            )
       ])

    withdrawFromVesting = Seq([
        Assert(basic_checks),
        Cond(
            [Txn.sender() == App.globalGet(Bytes("advisors")), If(Global.latest_timestamp() > initialTime + year,functionToWithdraw(Bytes("withdow_Advisors"),Bytes("AmountTotalAdvisors"),(Global.latest_timestamp()-initialTime)/month),Return(Int(0)))],
            [Txn.sender() == App.globalGet(Bytes("team")), If(Global.latest_timestamp() > initialTime + year,functionToWithdraw(Bytes("withdow_Team"),Bytes("AmountTotalTeam"),(Global.latest_timestamp()-initialTime)/month),Return(Int(0)))],
            [Txn.sender() == App.globalGet(Bytes("private_investor")), If(Global.latest_timestamp() > initialTime + year,functionToWithdraw(Bytes("withdow_PrivateInvestors"),Bytes("AmountTotalPrivateInvestors"),(Global.latest_timestamp()-initialTime)/month),Return(Int(0)))],
            [Txn.sender() == App.globalGet(Bytes("company_reserve")), signTransaction(Bytes("withdow_CompanyReserve"),App.globalGet(Bytes("AmountTotalCompanyReserve"))-App.globalGet(Bytes("withdow_CompanyReserve")))],
        ),

        Return(Int(1))
    ]) 
   

    handle_optin = Seq([
        Return(Int(0))
    ])

    handle_noop = Seq(
        Assert(basic_checks),
        Cond(
            [Txn.application_args[0] == Bytes("optin"), optin],
            [Txn.application_args[0] == Bytes("withdrawFromVesting"), withdrawFromVesting],
            [Txn.application_args[0] == Bytes("initTime"), initTime],
        )
    )
    handle_closeout = Return(Int(1))
    handle_updateapp = Return(Int(0))
    handle_deleteapp = Return(Int(0))

    program = Cond(
        [Txn.application_id() == Int(0), handle_creation],
        [Txn.on_completion() == OnComplete.OptIn, handle_optin],
        [Txn.on_completion() == OnComplete.CloseOut, handle_closeout],
        [Txn.on_completion() == OnComplete.UpdateApplication, handle_updateapp],
        [Txn.on_completion() == OnComplete.DeleteApplication, handle_deleteapp],
        [Txn.on_completion() == OnComplete.NoOp, handle_noop]
    )

    return program

if __name__ == "__main__":
    params = {}

    # Overwrite params if sys.argv[1] is passed
    if(len(sys.argv) > 1):
        params = parse_params(sys.argv[1], params)

    print(compileTeal(vesting_approval(), mode=Mode.Application, version=6))