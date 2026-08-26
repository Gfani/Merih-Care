import { IsNotEmpty, Length } from "class-validator";

export class IdParamDto {
  @IsNotEmpty()
  @Length(4, 50)
  id: string;
}
