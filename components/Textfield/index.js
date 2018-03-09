import { Container, Label, Input } from './styles'

export default ({ label, type, name, placeholder, value, step }) => {
  return (
    <Container>
      <Label>{label}</Label>
      <Input
        name={name}
        type={type}
        step={step}
        placeholder={placeholder}
        value={value}
      />
    </Container>
  )
}
