from pyteal import *

def create_clearstate():
    return Return(Int(1))

if __name__ == "__main__":
    print(compileTeal(create_clearstate(), mode=Mode.Application, version=6))