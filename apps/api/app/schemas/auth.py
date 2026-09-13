from datetime import datetime

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


class BranchCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)


class MemberOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    branch: BranchOut | None = None

    model_config = {"from_attributes": True}


class InviteCreate(BaseModel):
    email: EmailStr
    role: str
    branch_id: str | None = None


class InviteOut(BaseModel):
    id: str
    email: str
    role: str
    branch: BranchOut | None = None
    expires_at: datetime
    accepted_at: datetime | None = None

    model_config = {"from_attributes": True}


class InviteCreated(BaseModel):
    invite: InviteOut
    token: str
    join_path: str


class InviteAccept(BaseModel):
    token: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=200)
    password: str = Field(min_length=8, max_length=128)
