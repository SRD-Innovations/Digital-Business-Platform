from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class RegisterRequest(BaseModel):
    business_name: str = Field(min_length=2, max_length=200)
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    identifier: str | None = Field(default=None, max_length=320)
    email: EmailStr | None = None
    password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def require_identifier(self) -> "LoginRequest":
        ident = (self.identifier or (str(self.email) if self.email else "")).strip()
        if len(ident) < 3:
            raise ValueError("Email or phone is required")
        self.identifier = ident
        return self


class TenantOut(BaseModel):
    id: str
    name: str
    slug: str
    legal_name: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    phone: str | None = None
    email: str | None = None
    tin: str | None = None
    vat_number: str | None = None

    model_config = {"from_attributes": True}


class TenantUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    legal_name: str | None = Field(default=None, max_length=200)
    address_line1: str | None = Field(default=None, max_length=200)
    address_line2: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=320)
    tin: str | None = Field(default=None, max_length=32)
    vat_number: str | None = Field(default=None, max_length=32)

    @field_validator(
        "legal_name",
        "address_line1",
        "address_line2",
        "city",
        "phone",
        "email",
        "tin",
        "vat_number",
        mode="before",
    )
    @classmethod
    def blank_to_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value


class BranchOut(BaseModel):
    id: str
    name: str

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: str
    email: str | None = None
    phone: str | None = None
    full_name: str
    role: str
    is_platform_admin: bool = False
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
    email: str | None = None
    phone: str | None = None
    full_name: str
    role: str
    branch: BranchOut | None = None

    model_config = {"from_attributes": True}


class InviteCreate(BaseModel):
    email: EmailStr | None = None
    phone: str | None = None
    role: str
    branch_id: str | None = None

    @field_validator("email", "phone", mode="before")
    @classmethod
    def blank_to_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @model_validator(mode="after")
    def require_contact(self) -> "InviteCreate":
        if not self.email and not self.phone:
            raise ValueError("Phone number or email is required")
        return self


class InviteOut(BaseModel):
    id: str
    email: str | None = None
    phone: str | None = None
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
