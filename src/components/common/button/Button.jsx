const Button = ({ buttonName, onClick, ...props }) => (
    <div onClick={onClick} {...props}>
        {buttonName}
    </div>
);

export default Button;