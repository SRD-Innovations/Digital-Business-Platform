from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    business_name: str = Field(min_length=2, max_length=200)
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TenantOut(BaseModel):
    id: str
    name: str
    slug: str

    model_config = {"from_attributes": True}


class BranchOut(BaseModel):
    id: str
    name: str

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    tenant: TenantOut
    branch: BranchOut | None = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
