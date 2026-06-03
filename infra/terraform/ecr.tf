resource "aws_ecr_repository" "nango" {
  name                 = "company-brain/nango"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "brain" {
  name                 = "company-brain/brain"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# Keep only the most recent images to control storage cost.
resource "aws_ecr_lifecycle_policy" "nango" {
  repository = aws_ecr_repository.nango.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Expire all but the 10 most recent images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_ecr_lifecycle_policy" "brain" {
  repository = aws_ecr_repository.brain.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Expire all but the 10 most recent images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}
